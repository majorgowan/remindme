const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const weekday = require("dayjs/plugin/weekday");

// Extend Day.js with plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(weekday);


function toUTCDate(date, time, timezone) {
    const utcDate = dayjs.tz(`${date} ${time}`, timezone).utc();
    return utcDate.toDate();
}

function toLocalDate(datetime, timezone) {
    return dayjs.utc(datetime).tz(timezone).format("YYYY-MM-DD");
}

function groupByDay(reminders) {
    return reminders.reduce((groups, reminder) => {
        const groupKey = toLocalDate(reminder.datetime);
        (groups[groupKey] = groups[groupKey] || []).push(reminder);
        return groups;
    }, {});
}

function getWeekStart(reminder) {
    return dayjs(reminder.date).weekday(1).format("YYYY-MM-DD");
}

function groupByWeek(reminders) {
    return reminders.reduce((groups, reminder) => {
        const weekStart = getWeekStart(reminder);
        (groups[weekStart] = groups[weekStart] || []).push(reminder);
        return groups;
    }, {});
}

function getDaysInFutureMonth(date, i) {
    return new Date(date.getFullYear(), date.getMonth() + i + 1, 0).getDate();
}

function repeatReminder(reminder, endDate) {
    // duplicate the provided reminder at the specified frequency
    let complete = false;
    const repeats = [];
    const frequency = reminder.frequency;
    const repeat = reminder.repeat;
    const span = Math.round((new Date(endDate) - new Date(reminder.date)) / (24 * 60 * 60 * 1000)) + 1;
    let times = span;
    if (repeat === "weekly") times = Math.floor(span / 7);
    else if (repeat === "monthly") times = Math.floor(span / 28);

    for (let i = 0; i < times; i += frequency) {
        const newReminder = {...reminder};
        newReminder.datetime = new Date(reminder.datetime);
        if (repeat === "daily") {
            newReminder.datetime.setDate(newReminder.datetime.getDate() + i);
        } else if (repeat === "weekly") {
            newReminder.datetime.setDate(newReminder.datetime.getDate() + 7 * i);
        } else if (repeat === "monthly") {
            const daysInFutureMonth = getDaysInFutureMonth(newReminder.datetime, i);
            newReminder.datetime.setDate(Math.min(newReminder.datetime.getDate(), daysInFutureMonth));
            newReminder.datetime.setMonth(newReminder.datetime.getMonth() + i);
        }
        // set local date for repeat reminder
        newReminder.date = newReminder.datetime.toISOString().slice(0, 10);

        repeats.push(newReminder);
        if (reminder.numberOfTimes && repeats.length === reminder.numberOfTimes) {
            complete = true;
            break;
        }
    }
    return {"repeats": repeats, "complete": complete};
}

function addWeeks(date, number = 1) {
    nextWeek = new Date(date);
    nextWeek.setHours(23, 0, 0, 0);
    nextWeek.setDate(nextWeek.getDate() + 7 * number);
    return nextWeek.toISOString().slice(0, 10);
}


module.exports = {toUTCDate, groupByDay, groupByWeek, repeatReminder, addWeeks}