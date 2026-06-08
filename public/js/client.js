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

    // get user's timezone
    const userTimezoneInput = document.getElementById("user_timezone");
    if (userTimezoneInput !== null) {
        userTimezoneInput.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    // implement searchbar
    const searchBar = document.getElementById("searchbar");
    if (searchBar !== null) {
        let timeoutId;
        const reminders = document.getElementsByClassName("reminder");
        searchBar.addEventListener("input", function(e) {
            const query = e.target.value;

            // Clear the previous timer if the user types again quickly
            clearTimeout(timeoutId);

            // Set a new timer to run the search after 300ms of silence
            timeoutId = setTimeout(() => {
                console.log("Searching for:", query);
                Array.from(reminders).forEach(reminder => {
                    // remove .hiddenreminder class from all reminder rows
                    reminder.classList.remove("hiddenreminder");
                    // add .hiddenreminder class to reminder rows not matching query
                    const reminderText = reminder.querySelector("td.remindertext").textContent;
                    if (!reminderText.toLowerCase().includes(query.toLowerCase())) {
                        reminder.classList.add("hiddenreminder");
                    }
                });
            }, 300);
        })
    }

});
