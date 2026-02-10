# Stripe Testing Helper Script
# Quick wrapper to run Stripe CLI commands without changing directories

param(
    [Parameter(Position=0)]
    [string]$Command = "help"
)

$STRIPE_PATH = "C:\stripe\stripe.exe"

# Check if Stripe CLI exists
if (-not (Test-Path $STRIPE_PATH)) {
    Write-Host "❌ Stripe CLI not found at $STRIPE_PATH" -ForegroundColor Red
    Write-Host "Please install Stripe CLI or update STRIPE_PATH in this script" -ForegroundColor Yellow
    exit 1
}

switch ($Command) {
    "listen" {
        Write-Host "🎧 Starting Stripe webhook forwarding..." -ForegroundColor Cyan
        & $STRIPE_PATH listen --forward-to http://localhost:9000/stripe/webhook
    }
    
    "trigger-success" {
        Write-Host "✅ Triggering payment_intent.succeeded..." -ForegroundColor Green
        & $STRIPE_PATH trigger payment_intent.succeeded
    }
    
    "trigger-fail" {
        Write-Host "❌ Triggering payment_intent.payment_failed..." -ForegroundColor Red
        & $STRIPE_PATH trigger payment_intent.payment_failed
    }
    
    "trigger-refund" {
        Write-Host "💰 Triggering charge.refunded..." -ForegroundColor Yellow
        & $STRIPE_PATH trigger charge.refunded
    }
    
    "events" {
        Write-Host "📋 Listing recent Stripe events..." -ForegroundColor Cyan
        & $STRIPE_PATH events list --limit 10
    }
    
    "version" {
        & $STRIPE_PATH --version
    }
    
    "login" {
        Write-Host "🔐 Logging in to Stripe..." -ForegroundColor Cyan
        & $STRIPE_PATH login
    }
    
    "help" {
        Write-Host @"
🔵 Stripe Testing Helper
========================

Usage: .\stripe-test.ps1 <command>

Commands:
  listen           Start webhook forwarding to localhost:9000
  trigger-success  Trigger payment_intent.succeeded event
  trigger-fail     Trigger payment_intent.payment_failed event
  trigger-refund   Trigger charge.refunded event
  events           List recent Stripe events
  login            Login to Stripe CLI
  version          Show Stripe CLI version
  help             Show this help message

Examples:
  .\stripe-test.ps1 listen
  .\stripe-test.ps1 trigger-success
  .\stripe-test.ps1 events

Quick Test Flow:
  1. Terminal 1: Start backend (npm run dev)
  2. Terminal 2: .\stripe-test.ps1 listen
  3. Terminal 3: .\stripe-test.ps1 trigger-success

"@ -ForegroundColor White
    }
    
    default {
        Write-Host "❓ Unknown command: $Command" -ForegroundColor Red
        Write-Host "Run '.\stripe-test.ps1 help' for available commands" -ForegroundColor Yellow
    }
}
