# Node.js Installation Guide for Windows

## Option 1: Download from Official Website (Recommended)

1. **Download Node.js**
   - Go to: https://nodejs.org/
   - Click "Download" for the LTS version (Long Term Support)
   - Choose the Windows Installer (.msi)

2. **Install Node.js**
   - Run the downloaded .msi file
   - Follow the installation wizard
   - Accept the license agreement
   - Choose installation path (default is fine)
   - Click "Install"

3. **Verify Installation**
   - Open Command Prompt or PowerShell
   - Run: `node --version`
   - Run: `npm --version`
   - You should see version numbers

4. **Restart Terminal**
   - Close and reopen your terminal/PowerShell
   - This ensures PATH is updated

## Option 2: Using Chocolatey (If installed)

```powershell
# Install Chocolatey if not already installed
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Node.js
choco install nodejs

# Verify installation
node --version
npm --version
```

## Option 3: Using Winget (Windows 10/11)

```powershell
# Install Node.js
winget install OpenJS.NodeJS

# Verify installation
node --version
npm --version
```

## After Installation

1. **Navigate to frontend directory**
   ```powershell
   cd "c:\Users\USER 2026\Desktop\Nyasha system Account\frontend"
   ```

2. **Install dependencies**
   ```powershell
   npm install
   ```

3. **Start development server**
   ```powershell
   npm run dev
   ```

4. **Access the application**
   - Open browser to: http://localhost:5173
   - This will connect to your backend at http://localhost:8000

## Troubleshooting

- If `node` command not found: Restart your terminal/computer
- If npm install fails: Try `npm install --force`
- If port 5173 is occupied: The server will automatically use next available port
- Make sure backend is running on http://localhost:8000 before starting frontend

## Environment Setup (Optional)

Create `.env` file in frontend directory:
```
VITE_API_URL=http://localhost:8000
```

This ensures frontend connects to your local backend.
