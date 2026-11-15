' ResQBot AI dashboard - starts server.bat with no window (used at Windows sign-in).
' Does nothing if the dashboard is already running.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)

On Error Resume Next
Set http = CreateObject("MSXML2.XMLHTTP")
http.Open "GET", "http://127.0.0.1:5000/api/state", False
http.Send
If Err.Number = 0 Then
  If http.Status = 200 Then WScript.Quit
End If
On Error GoTo 0

sh.Run "cmd /c """ & here & "\server.bat""", 0, False
