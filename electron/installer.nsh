!macro customFinishPage
  Function StartSnakeTogether
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  Function StartSnakeTogetherClassic
    ${if} ${isUpdated}
      StrCpy $1 "--classic-mode --updated"
    ${else}
      StrCpy $1 "--classic-mode"
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "open" "$1"
  FunctionEnd

  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_TEXT "Launch Snake Together"
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartSnakeTogether"
  !define MUI_FINISHPAGE_SHOWREADME
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Launch Snake Together Classic"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION "StartSnakeTogetherClassic"
  !define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
  !insertmacro MUI_PAGE_FINISH
!macroend

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
