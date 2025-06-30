import { useState, useEffect, useRef } from "react";
import {
  AirCredentialWidget,
  type ClaimRequest,
  type JsonDocumentObject,
  type Language,
} from "@mocanetwork/air-credential-sdk";
import "@mocanetwork/air-credential-sdk/dist/style.css";
import { AirService, BUILD_ENV } from "@mocanetwork/airkit";
import type { BUILD_ENV_TYPE } from "@mocanetwork/airkit";
import type { EnvironmentConfig } from "../../config/environments";

// Environment variables for configuration
const LOCALE = import.meta.env.VITE_LOCALE || "en";

interface CredentialField {
  id: string;
  name: string;
  type: "string" | "number" | "boolean" | "date";
  value: string | number | boolean;
}

interface CredentialIssuanceProps {
  airService: AirService | null;
  isLoggedIn: boolean;
  airKitBuildEnv: BUILD_ENV_TYPE;
  partnerId: string;
  environmentConfig: EnvironmentConfig;
}

const getIssuerAuthToken = async (
  issuerDid: string,
  apiKey: string,
  apiUrl: string
): Promise<string | null> => {
  try {
    const response = await fetch(`${apiUrl}/issuer/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "*/*",
        "X-Test": "true",
      },
      body: JSON.stringify({
        issuerDid: issuerDid,
        authToken: apiKey,
      }),
    });

    if (!response.ok) {
      throw new Error(`API call failed with status: ${response.status}`);
    }

    const data = await response.json();

    if (data.code === 80000000 && data.data && data.data.token) {
      return data.data.token;
    } else {
      console.error(
        "Failed to get issuer auth token from API:",
        data.msg || "Unknown error"
      );
      return null;
    }
  } catch (error) {
    console.error("Error fetching issuer auth token:", error);
    return null;
  }
};

const CredentialIssuance = ({
  airService,
  isLoggedIn,
  airKitBuildEnv,
  partnerId,
  environmentConfig,
}: CredentialIssuanceProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKYCModal, setShowKYCModal] = useState(false);
  const [showCredentialButton, setShowCredentialButton] = useState(false);
  const widgetRef = useRef<AirCredentialWidget | null>(null);

  // Configuration - these would typically come from environment variables or API
  const [config, setConfig] = useState({
    issuerDid:
      import.meta.env.VITE_ISSUER_DID ||
      "did:air:id:test:4P6aviTbQKGUZ27kjWDBgFrTp2CLcNCyEcszfu91jC",
    apiKey:
      import.meta.env.VITE_ISSUER_API_KEY ||
      "L1uIPkH2lNwDBt3Sjo47x9tbALEq5oRgGjO3TNL1", // api key
    credentialId:
      import.meta.env.VITE_CREDENTIAL_ID || "c21hi0g16093g02i20232N",
  });

  // Dynamic credential subject fields
  const [credentialFields, setCredentialFields] = useState<CredentialField[]>([
    {
      id: "1",
      name: "accountNumber",
      type: "number",
      value: 1234567890,
    },
    {
      id: "2",
      name: "creditScore",
      type: "number",
      value: 90,
    },
    {
      id: "3",
      name: "creditHistory",
      type: "string",
      value: "history: Good credit history with no late payments ",
    },
  ]);

  const handleConfigChange = (field: string, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const updateCredentialField = (
    id: string,
    field: Partial<CredentialField>
  ) => {
    setCredentialFields(
      credentialFields.map((f) => (f.id === id ? { ...f, ...field } : f))
    );
  };

  const convertFieldsToCredentialSubject = (): JsonDocumentObject => {
    const subject: JsonDocumentObject = {};
    credentialFields.forEach((field) => {
      if (field.name.trim()) {
        let value: string | number | boolean = field.value;

        // Convert value based on type
        switch (field.type) {
          case "number":
            value =
              typeof field.value === "string"
                ? parseFloat(field.value) || 0
                : field.value;
            break;
          case "boolean":
            value =
              typeof field.value === "string"
                ? field.value === "true"
                : field.value;
            break;
          case "date":
            if (typeof field.value === "string") {
              // Convert date string to YYYYMMDD format
              const date = new Date(field.value);
              if (!isNaN(date.getTime())) {
                value = parseInt(
                  date.getFullYear().toString() +
                    (date.getMonth() + 1).toString().padStart(2, "0") +
                    date.getDate().toString().padStart(2, "0")
                );
              }
            }
            break;
          default:
            value = field.value;
        }

        subject[field.name] = value;
      }
    });
    return subject;
  };

  const generateWidget = async () => {
    try {
      // Step 1: Fetch the issuer auth token using the API key
      const fetchedIssuerAuthToken = await getIssuerAuthToken(
        config.issuerDid,
        config.apiKey,
        environmentConfig.apiUrl
      );

      if (!fetchedIssuerAuthToken) {
        setError(
          "Failed to fetch issuer authentication token. Please check your DID and API Key."
        );
        setIsLoading(false);
        return;
      }

      const credentialSubject = convertFieldsToCredentialSubject();

      console.log("credentialSubject", credentialSubject);

      // Create the claim request with the fetched token
      const claimRequest: ClaimRequest = {
        process: "Issue",
        issuerDid: config.issuerDid,
        issuerAuth: fetchedIssuerAuthToken,
        credentialId: config.credentialId,
        credentialSubject: credentialSubject,
      };

      const rp = await airService
        ?.goToPartner(environmentConfig.widgetUrl)
        .catch((err) => {
          console.error("Error getting URL with token:", err);
        });

      console.log("urlWithToken", rp, rp?.urlWithToken);

      if (!rp?.urlWithToken) {
        console.warn(
          "Failed to get URL with token. Please check your partner ID."
        );
        setError("Failed to get URL with token. Please check your partner ID.");
        setIsLoading(false);
        return;
      }

      // Create and configure the widget with proper options
      widgetRef.current = new AirCredentialWidget(claimRequest, partnerId, {
        endpoint: rp?.urlWithToken,
        airKitBuildEnv: airKitBuildEnv || BUILD_ENV.STAGING,
        theme: "light", // currently only have light theme
        locale: LOCALE as Language,
      });

      // Set up event listeners
      widgetRef.current.on("issueCompleted", () => {
        setIsSuccess(true);
        setIsLoading(false);
        console.log("Credential issuance completed successfully!");
      });

      widgetRef.current.on("close", () => {
        setIsLoading(false);
        console.log("Widget closed");
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create widget");
      setIsLoading(false);
    }
  };

  const handleIssueCredential = async () => {
    setIsLoading(true);
    setError(null);
    setIsSuccess(false);

    console.log("credentialFields", credentialFields);

    try {
      //generate everytime to ensure the partner token passing in correctly
      await generateWidget();

      // Start the widget
      if (widgetRef.current) {
        widgetRef.current.launch();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setIsSuccess(false);
    setError(null);
    if (widgetRef.current) {
      widgetRef.current.destroy();
      widgetRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (widgetRef.current) {
        widgetRef.current.destroy();
      }
    };
  }, []);

  const renderFieldValueInput = (field: CredentialField) => {
    switch (field.type) {
      case "boolean":
        return (
          <select
            value={field.value.toString()}
            onChange={(e) =>
              updateCredentialField(field.id, {
                value: e.target.value === "true",
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        );
      case "date":
        return (
          <input
            type="date"
            value={typeof field.value === "string" ? field.value : ""}
            onChange={(e) =>
              updateCredentialField(field.id, { value: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        );
      case "number":
        return (
          <input
            type="number"
            value={field.value.toString()}
            onChange={(e) =>
              updateCredentialField(field.id, {
                value: parseFloat(e.target.value) || 0,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        );
      default:
        return (
          <input
            type="text"
            value={field.value.toString()}
            onChange={(e) =>
              updateCredentialField(field.id, { value: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Enter value"
          />
        );
    }
  };

  return (
    <div className="flex-1 p-2 sm:p-4 lg:p-8">
      <div className="w-full sm:max-w-2xl md:max-w-4xl lg:max-w-6xl sm:mx-auto bg-white rounded-lg shadow-lg p-2 sm:p-6 lg:p-8">
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-4">
            Open my credit bureau
          </h2>
          <p className="text-gray-600 text-sm sm:text-base">
            This form allows you to issue a credential to the user. The
            credential will be issued by the issuer specified in the
            configuration.
          </p>
        </div>

        {/* Configuration Section 
        <div className="mb-6 sm:mb-8">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-4">Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Issuer DID</label>
              <input
                type="text"
                value={config.issuerDid}
                onChange={(e) => handleConfigChange("issuerDid", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="did:example:issuer123"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Issuer API Key</label>
              <input
                type="text"
                value={config.apiKey}
                onChange={(e) => handleConfigChange("apiKey", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Your issuer API key"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Credential ID</label>
              <input
                type="text"
                value={config.credentialId}
                onChange={(e) => handleConfigChange("credentialId", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="credential-type-123"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Partner ID (from NavBar)</label>
              <input
                type="text"
                value={partnerId}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                placeholder="Partner ID from NavBar"
              />
            </div>
          </div>
        </div>
        */}

        {/* Dynamic Credential Subject Section */}
        <label>account number</label>
        <input
          type="text"
          value={credentialFields[0].value.toString()}
          onChange={(e) =>
            updateCredentialField(credentialFields[0].id, {
              value: e.target.value,
            })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 mb-4"
          placeholder="Enter account number"
        />

        {/* Environment Info 
        <div className="mb-6 sm:mb-8 p-2 sm:p-4 bg-gray-50 border border-gray-200 rounded-md">
          <h4 className="text-xs sm:text-sm font-medium text-gray-900 mb-1 sm:mb-2">Environment Configuration:</h4>
          <div className="text-xs text-gray-700 space-y-1">
            <p>
              <strong>Widget URL:</strong> {environmentConfig.widgetUrl}
            </p>
            <p>
              <strong>API URL:</strong> {environmentConfig.apiUrl}
            </p>
            <p>
              <strong>Theme:</strong> light
            </p>
            <p>
              <strong>Locale:</strong> {LOCALE}
            </p>
          </div>
        </div>
        */}

        {/* Status Messages */}
        {error && (
          <div className="mb-4 sm:mb-6 p-2 sm:p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-xs sm:text-base">{error}</p>
          </div>
        )}

        {isSuccess && (
          <div className="mb-4 sm:mb-6 p-2 sm:p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-800 text-xs sm:text-base">
              ✅ Credential issuance completed successfully!
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
          {/* KYC Process Button */}
          <button
            onClick={() => setShowKYCModal(true)}
            className="w-full sm:flex-1 bg-blue-600 text-white px-4 sm:px-6 py-3 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Start KYC Process
          </button>

          {showKYCModal && (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-white p-6 rounded-lg shadow-lg w-96">
                <h3 className="text-lg font-bold mb-4">KYC Process</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Please complete the KYC process by following the instructions.
                </p>
                <button
                  onClick={() => {
                    setShowKYCModal(false);
                    setShowCredentialButton(true);
                  }}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-md font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                >
                  Complete KYC
                </button>
              </div>
            </div>
          )}

          {showCredentialButton && (
            <button
              onClick={handleIssueCredential}
              disabled={isLoading || !isLoggedIn}
              className="w-full sm:flex-1 bg-brand-600 text-white px-4 sm:px-6 py-3 rounded-md font-medium hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Launching Widget...
                </span>
              ) : (
                "Start Credential Issuance Widget"
              )}
            </button>
          )}

          {isSuccess && (
            <button
              onClick={handleReset}
              className="w-full sm:w-auto px-4 sm:px-6 py-3 border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        {/* Instructions 
        <div className="mt-6 sm:mt-8 p-2 sm:p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h4 className="text-xs sm:text-sm font-medium text-blue-900 mb-1 sm:mb-2">Instructions:</h4>
          <ul className="text-xs sm:text-sm text-blue-800 space-y-1">
            <li>• Need to whitelist the cross partner domain in Airkit </li>
            <li>• Configure the issuer DID, API key, and credential ID</li>
            <li>• Add credential subject fields using the "Add Field" button</li>
            <li>• Set field name, type (string, number, boolean, date), and value</li>
            <li>• Click "Start Credential Issuance Widget" to start the process</li>
            <li>• The widget will handle the credential issuance flow</li>
          </ul>
        </div>*/}
      </div>
    </div>
  );
};

export default CredentialIssuance;
