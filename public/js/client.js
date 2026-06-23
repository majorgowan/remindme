document.addEventListener('DOMContentLoaded', () => {

    // refresh page every hour if on calendar page
    const calendarDiv = document.getElementById("calendar_div");
    if (calendarDiv === null) {
        setInterval(() => {
            window.location.reload();
        }, 60 * 60 * 1000);
    }

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

    // profile menu actions
    const changePasswordButtonDiv = document.getElementById("passwordbutton_div");
    const changePasswordDiv = document.getElementById("changepassword_div");
    if (changePasswordButtonDiv !== null) {
        const changePasswordButton = changePasswordButtonDiv.querySelector("button");
        const passwordInput = document.getElementById("password_input")
        const newPasswordInput = document.getElementById("new_password_input")
        const newPasswordConfirmInput = document.getElementById("new_password_confirm_input")
        const saveChangesButton = document.getElementById("save_changes_button");
        changePasswordButton.addEventListener("click", () => {
            changePasswordButtonDiv.classList.add("hiddeninput");
            changePasswordDiv.classList.remove("hiddeninput");
            saveChangesButton.disabled = true;
        });
        // compare new password and confirm-new password inputs for equality
        const comparePasswords = () => {
            if (passwordInput.value && newPasswordInput.value && newPasswordInput.value === newPasswordConfirmInput.value) {
                saveChangesButton.disabled = false;
            } else {
                saveChangesButton.disabled = true;
            }
        };
        passwordInput.addEventListener("change", comparePasswords);
        newPasswordInput.addEventListener("input", comparePasswords);
        newPasswordInput.addEventListener("blur", comparePasswords);
        newPasswordConfirmInput.addEventListener("input", comparePasswords);
        newPasswordConfirmInput.addEventListener("blur", comparePasswords);

        // alarm settings
        const alarmsInputCheckbox = document.getElementById("alarms_input");
        const alarmTriggerDiv = document.getElementById("alarmtrigger_div");
        alarmsInputCheckbox.addEventListener("change", () => {
            if (alarmsInputCheckbox.checked) {
                alarmTriggerDiv.classList.remove("hiddeninput");
            } else {
                alarmTriggerDiv.classList.add("hiddeninput");
            }
        });
    }


    // open reminder editor on click
    const reminderRows = document.querySelectorAll("tr.reminder");
    if (reminderRows.length > 0) {
        reminderRows.forEach(reminderRow => {
            let pressTimer;
            reminderRow.addEventListener("click", () => {
                window.location.href = `/edit?reminderId=${reminderRow.dataset.id}`;
            });
        });
    }

    // cancel/delete buttons in reminder edit form
    const cancelButton = document.getElementById("cancel_button");
    const deleteButton = document.getElementById("delete_button");
    const sureButton = document.getElementById("sure_button");
    if (cancelButton !== null) {
        cancelButton.addEventListener("click", (e) => {
            e.preventDefault();
            history.back();
        });
        deleteButton.addEventListener("click", (e) => {
            e.preventDefault();
            deleteButton.classList.add("hiddenbutton");
            sureButton.classList.remove("hiddenbutton");
            setTimeout(() => {
                // show confirm for 3 seconds and then revert
                deleteButton.classList.remove("hiddenbutton");
                sureButton.classList.add("hiddenbutton");
            }, 3000);
        });
    }


    // get user's timezone
    const userTimezoneInput = document.getElementById("user_timezone");
    if (userTimezoneInput !== null) {
        userTimezoneInput.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    // if repeat selector changes, reveal other options
    const repeatSelector = document.getElementById("repeat_select");
    if (repeatSelector !== null) {
        const frequencyDiv = document.getElementById("frequency_div");
        const numberoftimesDiv = document.getElementById("numberoftimes_div");
        const hoursofdayDiv = document.getElementById("hoursofday_div");
        const daysofweekDiv = document.getElementById("daysofweek_div");
        const daysofmonthDiv = document.getElementById("daysofmonth_div");
        const setpositionDiv = document.getElementById("setposition_div");
        const daysofweekCheckboxes = daysofweekDiv.querySelectorAll("input[type='checkbox']");
        repeatSelector.addEventListener("change", () => {
            const repeatValue = repeatSelector.value;
            frequencyDiv.classList.add("hiddeninput");
            numberoftimesDiv.classList.add("hiddeninput");
            daysofweekDiv.classList.add("hiddeninput");
            daysofmonthDiv.classList.add("hiddeninput");
            setpositionDiv.classList.add("hiddeninput");
            if (repeatValue === "never") {
                frequencyDiv.querySelector("input").value = "";
                numberoftimesDiv.querySelector("input").value = "";
                numberoftimesDiv.querySelector("input").placeholder = "never ends";
            } else {
                frequencyDiv.classList.remove("hiddeninput");
                numberoftimesDiv.classList.remove("hiddeninput");
                if (repeatValue !== "daily") {
                    daysofweekDiv.classList.remove("hiddeninput");
                    hoursofdayDiv.classList.add("hiddeninput");
                } else {
                    hoursofdayDiv.classList.remove("hiddeninput");
                }
                if (repeatValue === "monthly") {
                    daysofmonthDiv.classList.remove("hiddeninput");
                    // if no day of week is checked, hide the month position input
                    if ([...daysofweekCheckboxes].some(cb => cb.checked)) {
                        setpositionDiv.classList.remove("hiddeninput");
                    } else {
                        setpositionDiv.classList.add("hiddeninput");
                    }
                }
                frequencyDiv.querySelector("input").value = "1";
                numberoftimesDiv.querySelector("input").value = "";
                numberoftimesDiv.querySelector("input").placeholder = "never ends";
            }
        });

        // if repeat is monthly and any weekdays become unchecked, show the setPosition div
        for (const dow of daysofweekCheckboxes) {
            dow.addEventListener("change", (e) => {
                const repeatValue = repeatSelector.value;
                if (repeatValue === "monthly") {
                    if ([...daysofweekCheckboxes].some(cb => cb.checked)) {
                        setpositionDiv.classList.remove("hiddeninput");
                    } else {
                        setpositionDiv.classList.add("hiddeninput");
                    }
                }
            });
        }

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
