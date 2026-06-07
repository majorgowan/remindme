const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

// Extend Day.js with plugins
dayjs.extend(utc);
dayjs.extend(timezone);


function toUTCDate(date, time, timezone) {
    const utcDate = dayjs.tz(`${date} ${time}`, timezone).utc();
    return utcDate.toDate();
}


function groupByDay(data) {
   return data.reduce((groups, item) => {
       const groupKey = item.date;
       (groups[groupKey] = groups[groupKey] || []).push(item);
       return groups;
   }, {});
}

function getWeekStart(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const newDate = d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1);
    return new Date(d.setDate(newDate)).toISOString().slice(0, 10);
}

function groupByWeek(data) {
    return data.reduce((groups, item) => {
        const weekStart = getWeekStart(item.date);
        (groups[weekStart] = groups[weekStart] || []).push(item);
        return groups;
    }, {});
}

function getDaysInFutureMonth(date, i) {
    return new Date(date.getFullYear(), date.getMonth() + i + 1, 0).getDate();
}

function repeatReminder(reminder, endDate) {
    // duplicate the provided reminder at the specified frequency
    const repeats = [];
    const frequency = reminder.frequency;
    const repeat = reminder.repeat;
    const span = Math.round((new Date(endDate) - new Date(reminder.date)) / (24 * 60 * 60 * 1000)) + 1;
    let times = span;
    if (repeat === "weekly") times = Math.floor(span / 7);
    else if (repeat === "monthly") times = Math.floor(span / 28);

    for (let i = 0; i < times; i += frequency) {
        const newReminder = { ...reminder };
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
        newReminder.date = newReminder.datetime.toLocaleDateString(
            undefined, {"timeZone": reminder.timezone}
        ).slice(0, 10);

        repeats.push(newReminder);
    }
    return repeats;
}


module.exports = { toUTCDate, groupByDay, groupByWeek, repeatReminder }