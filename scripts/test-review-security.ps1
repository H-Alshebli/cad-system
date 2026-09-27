$ErrorActionPreference = 'Stop'
# Local demo emulator only. Never deploys rules or reads a real project.
$reviewRoot = Split-Path -Parent $PSScriptRoot
$reviewJava = 'C:\Program Files\Android\Android Studio\jbr'
if (!(Test-Path -LiteralPath (Join-Path $reviewJava 'bin\java.exe'))) {
  throw 'Java 21 runtime not found. Configure a Java 21 runtime before running the local emulator test.'
}
$originalJava = $env:JAVA_HOME
$originalPath = $env:PATH
Push-Location -LiteralPath $reviewRoot
try {
  $env:JAVA_HOME = $reviewJava
  $env:PATH = "$reviewJava\bin;$originalPath"
  & npm.cmd exec --yes --package firebase-tools@14.17.0 -- firebase emulators:exec --project demo-hcad-review --only firestore --config firebase.review-test.json 'node scripts/test-firestore-review-emulator.cjs'
  if ($LASTEXITCODE -ne 0) { throw 'Security test did not pass. Do not publish the rules.' }
} finally {
  $env:JAVA_HOME = $originalJava
  $env:PATH = $originalPath
  Pop-Location
}
