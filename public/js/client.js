document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.getElementById("dictated_text");
    textarea.addEventListener("keydown", function(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            this.form.submit();
        }
    });
});