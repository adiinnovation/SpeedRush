$port = 8080
$path = "C:\Users\DELL\.gemini\antigravity\scratch\speed-rush"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try {
    $listener.Start()
    Write-Output "Listening on http://localhost:$port/"
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $localPath = $request.Url.LocalPath.TrimStart('/')
        if ($localPath -eq '' -or $localPath -eq '/') { $localPath = 'index.html' }
        $filePath = Join-Path $path $localPath
        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = switch ($ext) {
                '.html' { 'text/html; charset=utf-8' }
                '.css'  { 'text/css; charset=utf-8' }
                '.js'   { 'application/javascript; charset=utf-8' }
                '.svg'  { 'image/svg+xml' }
                default { 'application/octet-stream' }
            }
            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $err = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($err, 0, $err.Length)
        }
        $response.Close()
    }
} catch {
    Write-Output "Error: $_"
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
}
