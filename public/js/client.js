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

    // if repeat selector changes, reveal other options
    const repeatSelector = document.getElementById("repeat_select");
    if (repeatSelector !== null) {
        repeatSelector.addEventListener("change", () => {
            const repeatValue = repeatSelector.value;
            const frequencyDiv = document.getElementById("frequency_div");
            const numberoftimesDiv = document.getElementById("numberoftimes_div");
            if (repeatValue === "never") {
                frequencyDiv.classList.add("hiddeninput");
                numberoftimesDiv.classList.add("hiddeninput");
                frequencyDiv.querySelector("input").value = "";
                numberoftimesDiv.querySelector("input").value = "";
                numberoftimesDiv.querySelector("input").placeholder = "never ends";
            } else {
                frequencyDiv.classList.remove("hiddeninput");
                numberoftimesDiv.classList.remove("hiddeninput");
                frequencyDiv.querySelector("input").value = "1";
                numberoftimesDiv.querySelector("input").value = "";
                numberoftimesDiv.querySelector("input").placeholder = "never ends";
            }
        });
        const numberOfTimesInput = document.getElementById("reminder_numberoftimes");
        numberOfTimesInput.addEventListener("change", () => {
            // if the numberOfTimes goes to 0, set value to "" and placeholder to "never ends"
            if (numberOfTimesInput.value <= 0) {
                numberOfTimesInput.value = 0;
                numberOfTimesInput.placeholder = "never ends";
            }
        });
    }


    // apply border (horizontal line) to first reminder in week
    function divideWeeks() {
        const weeks = document.querySelectorAll('tbody.calendarweek');
        if (weeks !== null) {
            weeks.forEach(week => {
                const rows = week.querySelectorAll("tr");

                for (const row of rows) {
                    row.querySelectorAll("td").forEach(cell => cell.classList.remove("calendarweekstart"));
                }

                for (const row of rows) {
                    if (!row.classList.contains("hiddenreminder")) {
                        // Found the first visible row!
                        row.querySelectorAll("td").forEach(cell => cell.classList.add("calendarweekstart"));
                        break; // Stop looping this week immediately
                    }
                }
            });
        }
    };
    divideWeeks();


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
                // console.log("Searching for:", query);
                Array.from(reminders).forEach(reminder => {

                    // remove .hiddenreminder class from all reminder rows
                    reminder.classList.remove("hiddenreminder");

                    // add .hiddenreminder class to reminder rows not matching query
                    const reminderText = reminder.querySelector("td.remindertext").textContent;
                    if (!reminderText.toLowerCase().includes(query.toLowerCase())) {
                        reminder.classList.add("hiddenreminder");
                    } else {
                        // add in the headrow details if the headrow is hidden
                        if (!reminder.classList.contains("headrow")) {
                            let prev = reminder.previousElementSibling;
                            while (prev) {
                                if (prev.classList.contains("headrow")) {
                                    if (prev.classList.contains("hiddenreminder")) {
                                        // the head row is hidden, show your day and date!
                                        reminder.querySelector("td.dayname").classList.remove("hiddendatecell");
                                        reminder.querySelector("td.shortdate").classList.remove("hiddendatecell");
                                    } else {
                                        // the head row is showing, hide your day and date!
                                        reminder.querySelector("td.dayname").classList.add("hiddendatecell");
                                        reminder.querySelector("td.shortdate").classList.add("hiddendatecell");
                                    }
                                    break; // Stop climbing
                                }
                                prev = prev.previousElementSibling;
                            }
                        }
                    }
                    divideWeeks();
                });
            }, 300);
        })
    }

});
