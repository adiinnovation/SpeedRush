SPEED RUSH AUDIO SYSTEM:
-----------------------
All sound effects (continuous engine hum modulated by vehicle speed, coin collection chime, crash explosion impact, level up fanfare, and UI clicks) are synthesized dynamically in real-time using the HTML5 Web Audio API inside script.js (SoundSystem class).

This guarantees:
1. Instant zero-latency sound synthesis without HTTP request delays.
2. 100% offline gameplay compatibility (works when opening index.html directly from local disk via file:// without CORS or audio loading restrictions).
3. Dynamic sound parameters (the engine RPM and pitch rise and fall realistically with vehicle acceleration).
