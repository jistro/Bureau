# AIR Credential Demo

A comprehensive React application demonstrating credential issuance and verification flows using the AIR Credential SDK.

## Features

- **Credential Issuance**: Complete flow for issuing digital credentials to users
- **Credential Verification**: Full verification process with detailed status

## Prerequisites

- Node.js 20+
- npm or yarn
- AIR Credential SDK access

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd air-credential-example
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Usage

### Credential Issuance

1. Navigate to the "Credential Issuance" tab
2. Configure the following parameters:
   - **Issuer DID**: Your issuer's decentralized identifier
   - **Issuer Auth Token**: Authentication token for the issuer
   - **Credential ID**: The type of credential to issue
   - **Project Name**: Name of your project
3. Manage credential subject fields:
   - Click "Add Field" to add new credential fields
   - For each field, specify:
     - Field Name (e.g., name, email, age)
     - Type (String, Number, Boolean, or Date)
     - Value
   - Use the delete button to remove unwanted fields
4. Click "Start Credential Issuance"
5. The AIR Credential widget will open and guide the user through the issuance process
6. You'll receive a success notification when the process completes

### Credential Verification

1. Navigate to the "Credential Verification" tab
2. Configure the following parameters:
   - **Verifier Auth Token**: Authentication token for the verifier
   - **Program ID**: The program ID for verification
   - **Project Name**: Name of your project
   - **Redirect URL for Issuer**: URL to redirect users who need to obtain credentials
3. Click "Start Credential Verification"
4. The widget will guide the user through the verification process
5. View the detailed verification result with status information

## Verification Statuses

The application supports the following verification statuses:

- **✅ Compliant**: Credential is valid and meets all requirements
- **❌ Non-Compliant**: Credential does not meet verification requirements
- **⏳ Pending**: Credential is waiting for blockchain confirmation
- **🔄 Revoking**: Credential is currently being revoked
- **🚫 Revoked**: Credential has been revoked and is no longer valid
- **⏰ Expired**: Credential has expired and is no longer valid
- **🔍 NotFound**: No credential was found matching the criteria

## Configuration

### Environment Variables

For production use, consider setting up environment variables for sensitive configuration:

```bash
# .env.local

# Issuance Configuration
VITE_ISSUER_DID=your-issuer-did
VITE_ISSUER_API_KEY=your-issuer-api-key
VITE_CREDENTIAL_ID=your-credential-id
VITE_ISSUER_PARTNER_ID=issuer-partner-id

# Verification Configuration
VITE_VERIFIER_DID=your-verifier-did
VITE_VERIFIER_API_KEY=your-verifier-api-key
VITE_PROGRAM_ID=your-program-id
VITE_VERIFIER_PARTNER_ID=verifier-partner-id

# General Configuration
VITE_LOCALE=en
VITE_REDIRECT_URL_FOR_ISSUER=http://localhost:5173/issue
```

### Environment-Based Configuration

The application uses environment-based configuration for Widget and API URLs:

- **Staging Environment**: Uses staging URLs for widget and API endpoints
- **Sandbox Environment**: Uses sandbox URLs for widget and API endpoints

The URLs are configured in `src/config/environments.ts` and automatically switch based on the environment selected in the NavBar dropdown.

### Partner ID Management

The application automatically switches Partner IDs based on the current route:

- **Issuance Route** (`/issue`): Uses `VITE_ISSUER_PARTNER_ID` as default
- **Verification Route** (`/verify`): Uses `VITE_VERIFIER_PARTNER_ID` as default

The Partner ID is displayed and editable in the NavBar. When you navigate between Issuance and Verification flows, the Partner ID will automatically update to the appropriate default for that flow. You can still manually edit the Partner ID in the NavBar to test different configurations.

### SDK Configuration

The application uses the AIR Credential SDK with the following configuration options:

- **Theme**: Auto (adapts to system preference)
- **Locale**: English (en)
- **Endpoint**: Default AIR endpoint
- **Redirect URL**: Configurable for credential issuance redirection

## Project Structure

```
src/
├── components/
│   ├── issuance/
│   │   └── CredentialIssuance.tsx    # Credential issuance component
│   ├── verification/
│   │   └── CredentialVerification.tsx # Credential verification component
│   └── NavBarLogin.tsx               # Navigation bar with wallet connection
├── App.tsx                           # Main application component
├── App.css                           # Custom styles
├── index.css                         # Tailwind CSS imports
└── main.tsx                          # Application entry point
```

## Dependencies

- **React 19**: Modern React with hooks
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **React Router**: Client-side routing
- **AIR Credential SDK**: Core credential functionality
- **Vite**: Fast build tool and dev server

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Troubleshooting

### Common Issues

1. **Widget not loading**: Check your auth tokens and configuration
2. **Import errors**: Ensure all dependencies are installed
3. **TypeScript errors**: Verify your TypeScript configuration

### Debug Mode

Enable debug logging by opening the browser console and looking for:

- initialization messages
- Event listener registrations
- Verification/issuance completion events

## License

This project is licensed under the MIT License.

## Support

For issues related to:

- **AIR Credential SDK**: Contact the AIR team
- **This Demo Application**: Open an issue in this repository
