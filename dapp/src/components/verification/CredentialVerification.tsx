import { useState, useEffect, useRef } from "react";
import {
  AirCredentialWidget,
  type QueryRequest,
  type VerificationResults,
  type Language,
} from "@mocanetwork/air-credential-sdk";
import "@mocanetwork/air-credential-sdk/dist/style.css";
import { type AirService, BUILD_ENV } from "@mocanetwork/airkit";
import type { BUILD_ENV_TYPE } from "@mocanetwork/airkit";
import type { EnvironmentConfig } from "../../config/environments";

// Environment variables for configuration
const LOCALE = import.meta.env.VITE_LOCALE || "en";

interface CredentialVerificationProps {
  airService: AirService | null;
  isLoggedIn: boolean;
  airKitBuildEnv: BUILD_ENV_TYPE;
  partnerId: string;
  environmentConfig: EnvironmentConfig;
}

const getVerifierAuthToken = async (
  verifierDid: string,
  apiKey: string,
  apiUrl: string
): Promise<string | null> => {
  try {
    const response = await fetch(`${apiUrl}/verifier/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "*/*",
        "X-Test": "true",
      },
      body: JSON.stringify({
        verifierDid: verifierDid,
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
        "Failed to get verifier auth token from API:",
        data.msg || "Unknown error"
      );
      return null;
    }
  } catch (error) {
    console.error("Error fetching verifier auth token:", error);
    return null;
  }
};

const CredentialVerification = ({
  airService,
  isLoggedIn,
  airKitBuildEnv,
  partnerId,
  environmentConfig,
}: CredentialVerificationProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [verificationResult, setVerificationResult] =
    useState<VerificationResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userType, setUserType] = useState("borrower"); // Default user type
  const [mockPieData, setMockPieData] = useState([
    { address: "", percentage: 40, color: "#60a5fa" },
    { address: "", percentage: 30, color: "#93c5fd" },
    { address: "", percentage: 30, color: "#3b82f6" },
  ]);
  const widgetRef = useRef<AirCredentialWidget | null>(null);

  // Mock data for dashboard
  const mockData = {
    lender: {
      amountLent: "15,000"
    },
    borrower: {
      amountBorrowed: "10,000"
    }
  };

  // Configuration - these would typically come from environment variables or API
  const [config, setConfig] = useState({
    apiKey:
      import.meta.env.VITE_VERIFIER_API_KEY ||
      "W9J6VXGJX0AT0lCvlIXibzNzWyB440QFuij0cicC",
    verifierDid:
      import.meta.env.VITE_VERIFIER_DID ||
      "did:key:81gFg9GZLm3RWTcEg1vHQKci33nfzwo9sWsCCk81yhnHcJ6tLSrJWfwcry78mEgxcP3MUajHQnp4Xgm1LeKVPvprGz",
    programId: import.meta.env.VITE_PROGRAM_ID || "c21hi031bwgz20003245NG",
    redirectUrlForIssuer:
      import.meta.env.VITE_REDIRECT_URL_FOR_ISSUER ||
      "http://localhost:5173/issue",
  });

  console.log("AirService in CredentialVerification:", airService);

  const generateRandomEVMAddress = () => {
    const hexChars = "0123456789abcdef";
    let address = "0x";
    for (let i = 0; i < 40; i++) {
      address += hexChars[Math.floor(Math.random() * hexChars.length)];
    }
    return address;
  };

  const generateWidget = async () => {
    try {
      // Step 1: Fetch the verifier auth token using the API key
      const fetchedVerifierAuthToken = await getVerifierAuthToken(
        config.verifierDid,
        config.apiKey,
        environmentConfig.apiUrl
      );

      if (!fetchedVerifierAuthToken) {
        setError(
          "Failed to fetch verifier authentication token. Please check your API Key."
        );
        setIsLoading(false);
        return;
      }

      // Create the query request with the fetched token
      const queryRequest: QueryRequest = {
        process: "Verify",
        verifierAuth: fetchedVerifierAuthToken,
        programId: config.programId,
      };

      const rp = await airService
        ?.goToPartner(environmentConfig.widgetUrl)
        .catch((err) => {
          console.error("Error getting URL with token:", err);
        });

      if (!rp?.urlWithToken) {
        console.warn(
          "Failed to get URL with token. Please check your partner ID."
        );
        setError("Failed to get URL with token. Please check your partner ID.");
        setIsLoading(false);
        return;
      }
      // Create and configure the widget with proper options
      widgetRef.current = new AirCredentialWidget(queryRequest, partnerId, {
        endpoint: rp?.urlWithToken,
        airKitBuildEnv: airKitBuildEnv || BUILD_ENV.STAGING,
        theme: "light", // currently only have light theme
        locale: LOCALE as Language,
        redirectUrlForIssuer: config.redirectUrlForIssuer || undefined,
      });

      // Set up event listeners
      widgetRef.current.on(
        "verifyCompleted",
        (results: VerificationResults) => {
          setVerificationResult(results);
          setIsLoading(false);
          console.log("Verification completed:", results);
        }
      );

      widgetRef.current.on("close", () => {
        setIsLoading(false);
        console.log("Widget closed");
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create widget");
      setIsLoading(false);
    }
  };

  const handleVerifyCredential = async () => {
    setIsLoading(true);
    setError(null);
    setVerificationResult(null);

    try {
      // Generate widget if not already created
      if (!widgetRef.current) {
        await generateWidget();
      }

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
    setVerificationResult(null);
    setError(null);
    if (widgetRef.current) {
      widgetRef.current.destroy();
      widgetRef.current = null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Compliant":
        return "text-green-800 bg-green-50 border-green-200";
      case "Non-Compliant":
        return "text-red-800 bg-red-50 border-red-200";
      case "Pending":
        return "text-yellow-800 bg-yellow-50 border-yellow-200";
      case "Revoking":
      case "Revoked":
        return "text-orange-800 bg-orange-50 border-orange-200";
      case "Expired":
        return "text-gray-800 bg-gray-50 border-gray-200";
      case "NotFound":
        return "text-purple-800 bg-purple-50 border-purple-200";
      default:
        return "text-gray-800 bg-gray-50 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Compliant":
        return "✅";
      case "Non-Compliant":
        return "❌";
      case "Pending":
        return "⏳";
      case "Revoking":
        return "🔄";
      case "Revoked":
        return "🚫";
      case "Expired":
        return "⏰";
      case "NotFound":
        return "🔍";
      default:
        return "❓";
    }
  };

  const getStatusDescription = (status: string) => {
    switch (status) {
      case "Compliant":
        return "The credential is valid and meets all verification requirements.";
      case "Non-Compliant":
        return "The credential does not meet the verification requirements.";
      case "Pending":
        return "The credential is waiting for confirmation on the blockchain.";
      case "Revoking":
        return "The credential is currently being revoked.";
      case "Revoked":
        return "The credential has been revoked and is no longer valid.";
      case "Expired":
        return "The credential has expired and is no longer valid.";
      case "NotFound":
        return "No credential was found matching the verification criteria.";
      default:
        return "Unknown verification status.";
    }
  };

  useEffect(() => {
    // Generate random EVM addresses for mock data
    setMockPieData((prev) =>
      prev.map((slice) => ({ ...slice, address: generateRandomEVMAddress() }))
    );

    return () => {
      if (widgetRef.current) {
        widgetRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="flex-1 p-2 sm:p-4 lg:p-8">
      <div className="max-w-full sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto bg-white rounded-lg shadow-lg p-2 sm:p-6 lg:p-8">
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-700 mb-2 sm:mb-4">
            Loan Dashboard
          </h2>
          <p className="text-gray-600 text-sm sm:text-base">
            Verify digital credentials and manage loan applications using the
            Air Credential Verification Widget.
          </p>
        </div>

        {/* User Type Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select User Type
          </label>
          <select
            value={userType}
            onChange={(e) => setUserType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="lender">Lender</option>
            <option value="borrower">Borrower</option>
          </select>
        </div>

        {/* Dashboard Section with Mock Graphs */}
        <div className="mb-6 sm:mb-8">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-4">
            {userType === "lender" ? "Lender Dashboard" : "Borrower Dashboard"}
          </h3>
          <div className="p-2 sm:p-4 border rounded-md">
            {userType === "lender" ? (
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Amount Lent:{" "}
                  <span className="font-bold">${mockData.lender.amountLent}</span>
                </p>
                <div className="h-40 bg-blue-100 rounded-md flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 100 50"
                    className="w-full h-full"
                  >
                    {mockPieData.map((slice, index) => {
                      const paid = Math.round(slice.percentage * 0.6); // Example: 60% paid
                      const remaining = slice.percentage - paid;

                      return (
                        <g key={index}>
                          {/* Paid portion */}
                          <rect
                            x={index * 30 + 10}
                            y={50 - paid}
                            width="20"
                            height={paid}
                            fill="#34d399" // Green for paid
                          />
                          {/* Remaining portion */}
                          <rect
                            x={index * 30 + 10}
                            y={50 - slice.percentage}
                            width="20"
                            height={remaining}
                            fill="#f87171" // Red for remaining
                          />
                          {/* Labels */}
                          <text
                            x={index * 30 + 20}
                            y={50 - slice.percentage + 5}
                            textAnchor="middle"
                            fontSize="3"
                            fill="white"
                          >
                            Paid: {paid}%
                          </text>
                          <text
                            x={index * 30 + 20}
                            y={50 - slice.percentage + 10}
                            textAnchor="middle"
                            fontSize="3"
                            fill="white"
                          >
                            Remaining: {remaining}%
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <div className="mt-4">
                  {mockPieData.map((slice, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <span
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: slice.color }}
                      ></span>
                      <span className="text-sm text-gray-600">
                        {slice.address}: {slice.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Precaution: If the borrower fails to pay on time, their
                  information will be disclosed to protocols or companies
                  requesting it. If the borrower completes payments on time, their
                  information will never be revealed, and you may receive a
                  percentage of the commission earned for the investigation.
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Amount Borrowed: {" "}
                  <span className="font-bold">
                    ${mockData.borrower.amountBorrowed}
                  </span>
                </p>
                <div className="h-40 bg-blue-100 rounded-md flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 100 50"
                    className="w-full h-full"
                  >
                    {mockPieData.map((slice, index) => {
                      const remaining = Math.round(slice.percentage * 0.6); // Example: 60% remaining
                      const paid = slice.percentage - remaining;

                      return (
                        <g key={index}>
                          {/* Remaining portion */}
                          <rect
                            x={index * 30 + 10}
                            y={50 - remaining}
                            width="20"
                            height={remaining}
                            fill="#f87171" // Red for remaining
                          />
                          {/* Paid portion */}
                          <rect
                            x={index * 30 + 10}
                            y={50 - slice.percentage}
                            width="20"
                            height={paid}
                            fill="#34d399" // Green for paid
                          />
                          {/* Labels */}
                          <text
                            x={index * 30 + 20}
                            y={50 - slice.percentage + 5}
                            textAnchor="middle"
                            fontSize="3"
                            fill="white"
                          >
                            Remaining: {remaining}%
                          </text>
                          <text
                            x={index * 30 + 20}
                            y={50 - slice.percentage + 10}
                            textAnchor="middle"
                            fontSize="3"
                            fill="white"
                          >
                            Paid: {paid}%
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <div className="mt-4">
                  {mockPieData.map((slice, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <span
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: slice.color }}
                      ></span>
                      <span className="text-sm text-gray-600">
                        {slice.address}: {slice.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Precaution: If debtors fail to pay on time, their information
                  will be disclosed to protocols or companies requesting it. If the
                  debtor completes payments on time, their information will never be
                  revealed, and you may receive a percentage of the commission earned
                  for the investigation.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Configuration Section 
        <div className="mb-6 sm:mb-8">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-4">Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Verifier DID</label>
              <input
                type="text"
                value={config.verifierDid}
                onChange={(e) => handleConfigChange("verifierDid", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Your verifier DID"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Verifier API Key</label>
              <input
                type="text"
                value={config.apiKey}
                onChange={(e) => handleConfigChange("apiKey", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Your verifier API key"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Program ID</label>
              <input
                type="text"
                value={config.programId}
                onChange={(e) => handleConfigChange("programId", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="program-123"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Redirect URL for Issuer</label>
              <input
                type="url"
                value={config.redirectUrlForIssuer}
                onChange={(e) => handleConfigChange("redirectUrlForIssuer", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="https://example.com/issue-credential"
              />
            </div>
          </div>
        </div>*/}

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
        </div>*/}

        {/* Status Messages */}
        {error && (
          <div className="mb-4 sm:mb-6 p-2 sm:p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-xs sm:text-base">{error}</p>
          </div>
        )}

        {/* Verification Results */}
        {verificationResult && (
          <div className="mb-6 sm:mb-8">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-4">
              Verification Results
            </h3>
            <div className="p-2 sm:p-4 border rounded-md">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900 text-sm sm:text-base">
                  Verification Result
                </h4>
                <span
                  className={`mt-2 sm:mt-0 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border ${getStatusColor(
                    verificationResult.status
                  )}`}
                >
                  {getStatusIcon(verificationResult.status)}{" "}
                  {verificationResult.status}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 mb-2">
                {getStatusDescription(verificationResult.status)}
              </p>
              <pre className="text-xs text-gray-500 bg-gray-50 p-2 rounded overflow-auto">
                {JSON.stringify(verificationResult, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
          <button
            onClick={handleVerifyCredential}
            disabled={isLoading || !isLoggedIn}
            className="w-full sm:flex-1 bg-verify-600 text-white px-4 sm:px-6 py-3 rounded-md font-medium hover:bg-verify-700 focus:outline-none focus:ring-2 focus:ring-verify-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
              "Start Credential Verification Widget"
            )}
          </button>

          {verificationResult && (
            <button
              onClick={handleReset}
              className="w-full sm:w-auto px-4 sm:px-6 py-3 border border-verify-300 text-verify-700 rounded-md font-medium hover:bg-verify-50 focus:outline-none focus:ring-2 focus:ring-verify-500 focus:ring-offset-2 transition-colors"
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
            <li>• Configure the verifier API key and program ID</li>
            <li>• Set the partner id</li>
            <li>• Set the redirect URL for issuer if required</li>
            <li>• Click "Start Credential Verification Widget" to start the process</li>
            <li>• The widget will handle the credential verification flow</li>
            <li>• Review the verification results after completion</li>
          </ul>
        </div>*/}
      </div>
    </div>
  );
};

export default CredentialVerification;
