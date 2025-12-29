# NSIS installer script for SideEye Workspace
# This script handles Windows-specific installation tasks

!macro customInstall
  # Create application data directory
  CreateDirectory "$APPDATA\SideEye Workspace"
  CreateDirectory "$APPDATA\SideEye Workspace\config"
  CreateDirectory "$APPDATA\SideEye Workspace\logs"
  
  # Set permissions for application data directory
  AccessControl::GrantOnFile "$APPDATA\SideEye Workspace" "(S-1-5-32-545)" "FullAccess"
  
  # Install Python dependencies if Python is available
  nsExec::ExecToLog '"$INSTDIR\resources\app\scripts\install-python-deps.js"'
  
  # Create desktop shortcut if requested
  ${If} $CreateDesktopShortcut == 1
    CreateShortcut "$DESKTOP\SideEye Workspace.lnk" "$INSTDIR\SideEye Workspace.exe" "" "$INSTDIR\SideEye Workspace.exe" 0
  ${EndIf}
  
  # Create start menu shortcuts
  CreateDirectory "$SMPROGRAMS\SideEye Workspace"
  CreateShortcut "$SMPROGRAMS\SideEye Workspace\SideEye Workspace.lnk" "$INSTDIR\SideEye Workspace.exe" "" "$INSTDIR\SideEye Workspace.exe" 0
  CreateShortcut "$SMPROGRAMS\SideEye Workspace\Uninstall SideEye Workspace.lnk" "$INSTDIR\Uninstall SideEye Workspace.exe"
  
  # Register application for camera permissions
  WriteRegStr HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\webcam" "Value" "Allow"
!macroend

!macro customUnInstall
  # Remove application data directory (ask user first)
  MessageBox MB_YESNO "Do you want to remove all application data including preferences and logs?" IDNO skip_data_removal
    RMDir /r "$APPDATA\SideEye Workspace"
  skip_data_removal:
  
  # Remove desktop shortcut
  Delete "$DESKTOP\SideEye Workspace.lnk"
  
  # Remove start menu shortcuts
  RMDir /r "$SMPROGRAMS\SideEye Workspace"
  
  # Clean up registry entries
  DeleteRegKey HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\SideEye Workspace"
!macroend

# Custom pages for installer
!macro customWelcomePage
  # Add custom welcome message
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customFinishPage
  # Add option to run first-run setup
  !define MUI_FINISHPAGE_RUN "$INSTDIR\SideEye Workspace.exe"
  !define MUI_FINISHPAGE_RUN_TEXT "Run SideEye Workspace now"
  !define MUI_FINISHPAGE_RUN_PARAMETERS "--first-run"
  !insertmacro MUI_PAGE_FINISH
!macroend