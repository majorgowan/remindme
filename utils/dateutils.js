const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const isoWeek = require("dayjs/plugin/isoWeek");
const { RRule, Frequency, Weekday } = require("rrule-es");

// Extend Day.js with plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);


function toUTCDate(date, time, timezone) {
    const utcDate = dayjs.tz(`${date} ${time}`, timezone).utc();
    return utcDate.toDate();
}

function toLocalDate(datetime, timezone) {
    return dayjs.utc(datetime).tz(timezone).format("YYYY-MM-DD");
}

function toLocalTime(datetime, timezone) {
    return dayjs.utc(datetime).tz(timezone).format("HH:mm");
}

function groupByDay(reminders) {
    return reminders.reduce((groups, reminder) => {
        const groupKey = toLocalDate(reminder.datetime, reminder.timezone);
        (groups[groupKey] = groups[groupKey] || []).push(reminder);
        return groups;
    }, {});
}

function getWeekStart(datetime, timezone, startDay=1) {
    const dateString = toLocalDate(datetime, timezone);
    let snapped = dayjs(toLocalDate(datetime, timezone)).isoWeekday(startDay).format("YYYY-MM-DD");
    if (dateString >= snapped) {
        return snapped;
    }
    return addWeeks(snapped, -1);
}

function groupByWeek(reminders) {
    return reminders.reduce((groups, reminder) => {
        const weekStart = getWeekStart(reminder.datetime, reminder.timezone);
        (groups[weekStart] = groups[weekStart] || []).push(reminder);
        return groups;
    }, {});
}

function repeatReminder(reminder, startDate, endDate) {
    // replicate the provided reminder at the specified frequency
    const repeatDates = reminder.repeatDates
        ? reminder.repeatDates.filter(rd => {
            return (!startDate || toLocalDate(rd, reminder.timezone) >= startDate)
                && toLocalDate(rd, reminder.timezone) <= endDate;
        })
        : getDates(reminder, startDate ? startDate : reminder.date, endDate);
    const repeats = repeatDates.map(rd => {
        const newReminder = {...reminder};
        newReminder.datetime = rd;
        newReminder.date = toLocalDate(rd, reminder.timezone);
        newReminder.time = toLocalTime(rd, reminder.timezone);
        return newReminder;
    });
    return {"repeats": repeats, "complete": repeats.length >= reminder.numberOfTimes};
}

function addWeeks(date, number = 1) {
    nextWeek = new Date(date);
    nextWeek.setHours(23, 0, 0, 0);
    nextWeek.setDate(nextWeek.getDate() + 7 * number);
    return nextWeek.toISOString().slice(0, 10);
}

function reminderToRRule(reminder) {
    return new RRule({
        "freq": Frequency[reminder.repeat.toUpperCase()],
        "dtStart": reminder.datetime,
        "tzid": reminder.timezone,
        "count": reminder.numberOfTimes ? reminder.numberOfTimes : null,
        "interval": reminder.frequency ? reminder.frequency : null,
        "byHour": reminder.hoursOfDay && reminder.hoursOfDay.length > 0 ? reminder.hoursOfDay : null,
        "byDay": reminder.daysOfWeek && reminder.daysOfWeek.filter(dow => dow).length > 0
            ? reminder.daysOfWeek.map(dow => Weekday[dow.toUpperCase()]).filter(dow => dow)
            : null,
        "byMonthDay": reminder.daysOfMonth && reminder.daysOfMonth.length > 0 ? reminder.daysOfMonth : null,
        "bySetPos": reminder.setPosition && reminder.setPosition.length > 0 ? reminder.setPosition : null
    });
}

function rruleEsToString(rule) {
    const p = rule.params;
    const parts = [];

    // 1. Frequency (Required)
    const freqs = ['YEARLY', 'MONTHLY', 'WEEKLY', 'DAILY', 'HOURLY', 'MINUTELY', 'SECONDLY'];
    if (p.freq !== undefined) parts.push(`FREQ=${freqs[p.freq]}`);

    // 2. Interval
    if (p.interval && p.interval > 1) parts.push(`INTERVAL=${p.interval}`);

    // 3. Count & Until
    if (p.count) parts.push(`COUNT=${p.count}`);
    if (p.until) {
        const u = new Date(p.until);
        parts.push(`UNTIL=${u.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'}`);
    }

    // 4. BY Rules (Arrays)
    if (p.byDay && p.byDay.length) {
        const days = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
        const val = p.byDay.map(d => {
            // Handle simple numbers (1-7) or objects
            if (typeof d === 'number') return days[d - 1];
            if (d.weekday) return days[d.weekday - 1];
            return d.toString();
        }).join(',');
        parts.push(`BYDAY=${val}`);
    }

    if (p.byMonth && p.byMonth.length) parts.push(`BYMONTH=${p.byMonth.join(',')}`);

    if (p.byMonthDay && p.byMonthDay.length) parts.push(`BYMONTHDAY=${p.byMonthDay.join(',')}`);

    if (p.byWeekNo && p.byWeekNo.length) parts.push(`BYWEEKNO=${p.byWeekNo.join(',')}`);

    if (p.byYearDay && p.byYearDay.length) parts.push(`BYYEARDAY=${p.byYearDay.join(',')}`);

    if (p.byHour && p.byHour.length) parts.push(`BYHOUR=${p.byHour.join(',')}`);

    if (p.byMinute && p.byMinute.length) parts.push(`BYMINUTE=${p.byMinute.join(',')}`);

    if (p.bySecond && p.bySecond.length) parts.push(`BYSECOND=${p.bySecond.join(',')}`);

    if (p.bySetPos && p.bySetPos.length) parts.push(`BYSETPOS=${p.bySetPos.join(',')}`);

    // 5. Week Start
    if (p.wkst) {
        const days = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
        parts.push(`WKST=${typeof p.wkst === 'number' ? days[p.wkst - 1] : p.wkst}`);
    }

    return parts.join(';');
}

function getDates(reminder, startDate, endDate) {
    if (reminder.repeat === "never") return [reminder.datetime];

    const rule = reminderToRRule(reminder);
    return rule.between(new Date(startDate), new Date(endDate));
}


module.exports = { toUTCDate, toLocalDate, toLocalTime, groupByDay, groupByWeek, repeatReminder, addWeeks,
    getWeekStart, reminderToRRule, rruleEsToString, getDates };