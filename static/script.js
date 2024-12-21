document.addEventListener("DOMContentLoaded", () => {
    const youtubeAnalyze = document.getElementById("youtubeAnalyze");
    const youtubeUrl = document.getElementById("youtubeUrl");
    const youtubeResults = document.getElementById("youtubeResults");

    youtubeAnalyze.addEventListener("click", () => {
        const url = youtubeUrl.value.trim();
        if (!url) {
            alert("Please enter a valid URL");
            return;
        }

        fetch("/analyze", {
            method: "POST",
            body: new URLSearchParams({ url }),
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.error) {
                    alert(data.error);
                    return;
                }

                youtubeResults.innerHTML = data.video_formats
                    .map(
                        (f) => `
                            <div>
                                <button onclick="download('${url}', '${f.format_id}', 'video')">
                                    Download ${f.resolution}p
                                </button>
                            </div>
                        `
                    )
                    .join("");
            })
            .catch((err) => {
                console.error(err);
                alert("Error analyzing the video");
            });
    });
});

function download(url, format_id, mode) {
    fetch("/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, format_id, mode }),
    })
        .then((res) => res.blob())
        .then((blob) => {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "video.mp4";
            link.click();
        })
        .catch((err) => {
            console.error(err);
            alert("Error downloading the file");
        });
}
