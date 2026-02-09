# WhisprSpace - Apply All Migrations
# PowerShell script to apply database migrations to Supabase

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "WhisprSpace Migration Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
Write-Host "Checking for Supabase CLI..." -ForegroundColor Yellow
$supabaseInstalled = Get-Command npx -ErrorAction SilentlyContinue

if (-not $supabaseInstalled) {
    Write-Host "Error: Node.js/npx not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

Write-Host "✓ Supabase CLI ready" -ForegroundColor Green
Write-Host ""

# Ask for project reference
Write-Host "Enter your Supabase project reference ID:" -ForegroundColor Yellow
Write-Host "(Find it at: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/general)" -ForegroundColor Gray
$projectRef = Read-Host "Project Ref"

if ([string]::IsNullOrWhiteSpace($projectRef)) {
    Write-Host "Error: Project reference is required." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Step 1: Linking to Supabase Project" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Link project
npx supabase link --project-ref $projectRef

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to link project. Check your project reference." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Step 2: Applying Migrations" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "The following migrations will be applied:" -ForegroundColor Yellow
Write-Host "  1. 20251018195741_initial_schema.sql" -ForegroundColor Gray
Write-Host "  2. 20251018204753_row_level_security.sql" -ForegroundColor Gray
Write-Host "  3. 20251018230000_group_functions.sql" -ForegroundColor Gray
Write-Host "  4. 20251018235000_notification_triggers.sql" -ForegroundColor Gray
Write-Host "  5. 20251019000000_direct_messaging.sql" -ForegroundColor Gray
Write-Host "  6. 20251019010000_gamification_enhancements.sql" -ForegroundColor Gray
Write-Host "  7. 20251019020000_analytics_admin_moderation.sql" -ForegroundColor Gray
Write-Host ""

$confirm = Read-Host "Continue? (y/n)"
if ($confirm -ne 'y') {
    Write-Host "Migration cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Applying migrations..." -ForegroundColor Yellow
npx supabase db push

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Migration failed. Check the error messages above." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Green
Write-Host "✓ Migrations Applied Successfully!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Create your first admin user (see instructions below)" -ForegroundColor White
Write-Host "2. Populate bad words list (optional)" -ForegroundColor White
Write-Host "3. Test the integration" -ForegroundColor White
Write-Host ""

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Create First Admin User" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Run this SQL in Supabase Dashboard > SQL Editor:" -ForegroundColor Yellow
Write-Host ""
Write-Host "INSERT INTO admin_users (user_id, role, permissions)" -ForegroundColor White
Write-Host "VALUES (" -ForegroundColor White
Write-Host "  'YOUR_USER_UUID'," -ForegroundColor White
Write-Host "  'super_admin'," -ForegroundColor White
Write-Host "  '{\"all\": true}'::jsonb" -ForegroundColor White
Write-Host ");" -ForegroundColor White
Write-Host ""
Write-Host "Find your user UUID at:" -ForegroundColor Gray
Write-Host "Dashboard > Authentication > Users" -ForegroundColor Gray
Write-Host ""

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
