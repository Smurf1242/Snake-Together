!macro customInstall
  CreateShortCut "$SMPROGRAMS\Snake Together Classic.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--classic-mode" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
  CreateShortCut "$DESKTOP\Snake Together Classic.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--classic-mode" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
  CreateShortCut "$SMPROGRAMS\Snake Together Updater.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--updater-mode" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
  CreateShortCut "$DESKTOP\Snake Together Updater.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--updater-mode" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\Snake Together Classic.lnk"
  Delete "$DESKTOP\Snake Together Classic.lnk"
  Delete "$SMPROGRAMS\Snake Together Updater.lnk"
  Delete "$DESKTOP\Snake Together Updater.lnk"
!macroend
