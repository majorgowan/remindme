document.addEventListener('DOMContentLoaded', () => {

    const micButton = document.getElementById("remindmespeak");
    const dictatedText = document.getElementById("dictated_text");

    if (micButton) {

        const transcriptArea = document.getElementById("dictated_text");

        // const apiKeyInput = document.getElementById("apiKeyInput");

        let mediaRecorder;
        let socket;
        let stream;
        let keepAliveInterval;

        function stopRecording() {
            if (!mediaRecorder) return;
            mediaRecorder.stop();

            if (stream) {
                stream.getTracks().forEach(track => track.stop()); // Turn off mic light
            }

            if (socket) socket.close();

            clearInterval(keepAliveInterval);

            // Reset UI
            mediaRecorder = null;
            socket = null;
            stream = null;
            dictatedText.classList.remove("recording");
        }


        async function startRecording() {

            if (mediaRecorder) return; // Already recording

            // get temporary Deepgram API key
            const response = await fetch("/getdeepgramkey");
            const json = await response.json();
            const API_KEY = json.key;

            // console.log("1. Starting...");

            try {
                // 1. Get Stream
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 16000 // Deepgram prefers 16k
                    }
                });
                // console.log("2. Mic Granted");

                // Connect to Deepgram
                socket = new WebSocket("wss://api.deepgram.com/v1/listen", ["token", API_KEY]);

                socket.onopen = () => {
                    // console.log("3. WebSocket Open");

                    // 4. Setup MediaRecorder (FIXED ORDER & MIME TYPE)
                    mediaRecorder = new MediaRecorder(stream, {mimeType: "audio/webm"});

                    mediaRecorder.ondataavailable = (event) => {
                        if (event.data.size > 0) {
                            // console.log("4. Audio Chunk Sent:", event.data.size, "bytes");
                            if (socket && socket.readyState === WebSocket.OPEN) {
                                socket.send(event.data);
                            }
                        }
                    };

                    mediaRecorder.onerror = (err) => {
                        console.error("MediaRecorder Error:", err);
                    };

                    // Start recording with 250ms timeslice
                    mediaRecorder.start(250);
                    // console.log("5. MediaRecorder Started (250ms)");
                    dictatedText.classList.add("recording");

                    // KeepAlive (Prevents Deepgram timeout)
                    keepAliveInterval = setInterval(() => {
                        if (socket.readyState === WebSocket.OPEN) {
                            socket.send(JSON.stringify({type: "KeepAlive"}));
                        }
                    }, 5000);
                };

                socket.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    if (data.channel && data.channel.alternatives && data.channel.alternatives[0]) {
                        const text = data.channel.alternatives[0].transcript;
                        if (data.is_final) {
                            transcriptArea.value += text + " ";
                        }
                    }
                };

                socket.onerror = (err) => {
                    console.error("Socket Error:", err);
                    // Check if the token is actually valid by logging it (temporarily)
                    // console.log("Token being used:", API_KEY);
                };

                socket.onclose = (e) => {
                    // console.log("Socket Closed");
                    clearInterval(keepAliveInterval);
                    console.error(`Socket Closed: Code ${e.code}, Reason: ${e.reason}`);
                };

            } catch (err) {
                console.error("Fatal:", err);
            }
        }

        // add event listeners for touchscreen
        micButton.addEventListener("mousedown", async (e) => {
            e.preventDefault();
            startRecording();
        });
        micButton.addEventListener("mouseup", stopRecording);
        micButton.addEventListener("touchstart", async (e) => {
            e.preventDefault();
            startRecording();
        }, { "passive": false });
        micButton.addEventListener("touchend", async (e) => {
            e.preventDefault();
            stopRecording();
        });
        micButton.addEventListener("touchcancel", stopRecording);

    }

});