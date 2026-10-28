; VOID Mind visual configuration for the stock Tauri NSIS template.
; These Modern UI constants are included before page macros are expanded.
!define MUI_BGCOLOR "000000"
!define MUI_TEXTCOLOR "E8EDF4"
!define MUI_HEADER_TRANSPARENT_TEXT
!define MUI_DIRECTORYPAGE_BGCOLOR "090909"
!define MUI_INSTFILESPAGE_COLORS "E8EDF4 000000"
!define MUI_FINISHPAGE_LINK_COLOR "E8EDF4"
!define MUI_ABORTWARNING
!define MUI_CUSTOMFUNCTION_GUIINIT VoidMindGuiInit

Function VoidMindGuiInit
  ; MUI colors the page surface, while the root dialog owns the navigation footer.
  ; Color both so the setup reads as one uninterrupted VOID surface.
  SetCtlColors $HWNDPARENT E8EDF4 000000

  GetDlgItem $0 $HWNDPARENT 1
  SetCtlColors $0 000000 E8EDF4

  GetDlgItem $0 $HWNDPARENT 2
  SetCtlColors $0 E8EDF4 101010

  GetDlgItem $0 $HWNDPARENT 3
  SetCtlColors $0 E8EDF4 101010

  GetDlgItem $0 $HWNDPARENT 1034
  SetCtlColors $0 8A9099 000000
FunctionEnd
