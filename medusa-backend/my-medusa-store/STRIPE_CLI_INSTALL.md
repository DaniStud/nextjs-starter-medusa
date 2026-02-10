# Stripe CLI Installation Guide (Windows)

## Quick Install (Recommended)

### Option 1: Scoop (Easiest)

If you have Scoop installed:
```powershell
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

### Option 2: Direct Download

1. Download the Windows installer from: https://github.com/stripe/stripe-cli/releases/latest
2. Look for `stripe_X.X.X_windows_x86_64.zip`
3. Extract to a folder (e.g., `C:\stripe`)
4. Add to PATH:
   ```powershell
   # Open PowerShell as Administrator
   $env:Path += ";C:\stripe"
   [System.Environment]::SetEnvironmentVariable("Path", $env:Path, [System.EnvironmentVariableTarget]::Machine)
   ```
5. Restart PowerShell

### Option 3: Chocolatey

If you have Chocolatey:
```powershell
choco install stripe-cli
```

## Verify Installation

```powershell
stripe --version
```

Should show: `stripe version X.X.X`

## Login to Stripe

```powershell
stripe login
```

This will:
1. Open your browser
2. Ask you to log in to Stripe Dashboard
3. Grant access to the CLI
4. Return a confirmation in the terminal

## Test Stripe CLI

```powershell
# List recent events
stripe events list

# Should show recent Stripe events from your account
```

## Quick Start After Installation

Once installed and logged in:

```powershell
# Start webhook forwarding
stripe listen --forward-to http://localhost:9000/stripe/webhook

# In another terminal, trigger a test event
stripe trigger payment_intent.succeeded
```

## Troubleshooting

### "stripe: command not found"
- Restart PowerShell after installation
- Check PATH includes Stripe CLI directory
- Try running as Administrator

### "No such API key"
- Run `stripe login` again
- Verify you're logged into the correct Stripe account

### "Connection refused"
- Make sure Medusa backend is running (`npm run dev`)
- Check port 9000 is not blocked by firewall

## Alternative: Test Without Stripe CLI

If you can't install Stripe CLI right now, you can still test using:

1. **Stripe Dashboard Webhook Testing**:
   - Go to https://dashboard.stripe.com/test/webhooks
   - Click "Add endpoint"
   - Use a tool like ngrok to expose localhost
   - Trigger test events from dashboard

2. **Manual Checkout Testing**:
   - Use the storefront to make real test purchases
   - Enter test card numbers
   - Webhooks will be sent automatically

3. **Skip CLI Testing for Now**:
   - Proceed with storefront-based testing (Test Scenarios 2-4)
   - Come back to CLI testing later

## Next Steps

After installation:
1. ✅ Verify `stripe --version` works
2. ✅ Run `stripe login`
3. ✅ Start webhook forwarding
4. → Continue with [TEST_COMMANDS.md](TEST_COMMANDS.md)
