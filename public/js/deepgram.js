document.addEventListener('DOMContentLoaded', () => {

    const micButton = document.getElementById("remindmespeak");

    if (micButton) {
        console.log("Found mic button!!!");

        const transcriptArea = document.getElementById("dictated_text");

        // const apiKeyInput = document.getElementById("apiKeyInput");

        let mediaRecorder;
        let socket;
        let keepAliveInterval;

        micButton.addEventListener("click", async () => {
            if (mediaRecorder) {
                mediaRecorder.stop();
                if (socket) socket.close();
                clearInterval(keepAliveInterval);
                return;
            }

            const response = await fetch("/getdeepgramkey");
            const json = await response.json();
            const API_KEY = json.key;
            if (!API_KEY) {
                alert("Enter API Key");
                return;
            }

            console.log("1. Starting...");

            try {
                // 1. Get Stream
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 16000 // Deepgram prefers 16k
                    }
                });
                console.log("2. Mic Granted");

                // 2. Connect to Deepgram
                console.log(API_KEY);
                socket = new WebSocket("wss://api.deepgram.com/v1/listen", ["token", API_KEY]);

                socket.onopen = () => {
                    console.log("3. WebSocket Open");

                    // 4. Setup MediaRecorder (FIXED ORDER & MIME TYPE)
                    mediaRecorder = new MediaRecorder(stream, {mimeType: "audio/webm"});

                    mediaRecorder.ondataavailable = (event) => {
                        if (event.data.size > 0) {
                            console.log("4. Audio Chunk Sent:", event.data.size, "bytes");
                            if (socket.readyState === WebSocket.OPEN) {
                                socket.send(event.data);
                            }
                        }
                    };

                    mediaRecorder.onerror = (err) => {
                        console.error("MediaRecorder Error:", err);
                    };

                    // Start recording with 250ms timeslice
                    mediaRecorder.start(250);
                    console.log("5. MediaRecorder Started (250ms)");

                    // 6. KeepAlive (Prevents Deepgram timeout)
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
                    console.log("Token being used:", API_KEY);
                };

                socket.onclose = (e) => {
                    console.log("Socket Closed");
                    clearInterval(keepAliveInterval);
                    console.log(`Socket Closed: Code ${e.code}, Reason: ${e.reason}`);
                };

            } catch (err) {
                console.error("Fatal:", err);
            }
        });
    }

});