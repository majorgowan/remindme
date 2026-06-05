document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.getElementById("dictated_text");
    if (textarea) {
        textarea.addEventListener("keydown", function(e) {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.form.submit();
            }
        });
    }

    // For hamburger menu on mobile
    const hamburger = document.getElementById("hamburger");
    const subnav = document.getElementById("subnav");

    hamburger.addEventListener("click", () => {
        // Toggle the "active" class on both elements
        hamburger.classList.toggle("active");
        subnav.classList.toggle("active");
    });

    // Optional: Close menu when a link is clicked
    document.querySelectorAll(".subnav a").forEach(link => {
        link.addEventListener("click", () => {
            hamburger.classList.remove("active");
            subnav.classList.remove("active");
        });
    });

});
