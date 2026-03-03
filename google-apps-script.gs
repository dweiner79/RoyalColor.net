/**
 * Royal Color Analysis & Styling — Booking Calendar API
 * Google Apps Script — Deploy as a Web App
 *
 * ═══════════════════════════════════════════════════════
 * SETUP INSTRUCTIONS
 * ═══════════════════════════════════════════════════════
 *
 * 1. Go to  https://script.google.com
 *    Sign in as royalcoloranalysis@gmail.com
 *
 * 2. Click  "+ New project"
 *
 * 3. Delete the default code and paste this ENTIRE file.
 *
 * 4. Click  Deploy → New deployment
 *    - Type:            Web app
 *    - Execute as:      Me (royalcoloranalysis@gmail.com)
 *    - Who has access:  Anyone
 *    Click "Deploy"
 *
 * 5. When prompted, click "Authorize access" and allow
 *    the script to manage your Google Calendar.
 *
 * 6. Copy the Web App URL (looks like:
 *    https://script.google.com/macros/s/XXXXX/exec )
 *
 * 7. Open booking.html in your website files and replace
 *    the placeholder APPS_SCRIPT_URL near the top of the
 *    <script> block with your Web App URL.
 *
 * 8. Re-upload the website to your server.
 *
 * ═══════════════════════════════════════════════════════
 * IMPORTANT: After ANY code change you must re-deploy:
 *   Deploy → Manage deployments → Edit (pencil icon)
 *   → Version: "New version" → Deploy
 * ═══════════════════════════════════════════════════════
 */

// ============ CONFIGURATION ============

var CONFIG = {
  CALENDAR_ID: 'royalcoloranalysis@gmail.com',

  // Business hours per day-of-week (0 = Sunday … 6 = Saturday)
  // Omit a day or set to null to mark it as closed.
  BUSINESS_HOURS: {
    1: { start: 9, end: 19 },   // Monday    9 am – 7 pm
    2: { start: 9, end: 19 },   // Tuesday
    3: { start: 9, end: 19 },   // Wednesday
    4: { start: 9, end: 19 },   // Thursday
    5: { start: 9, end: 19 },   // Friday
    6: { start: 10, end: 16 }   // Saturday  10 am – 4 pm
    // 0 (Sunday) — closed
  },

  BUFFER_MINUTES: 60,           // Block 1 hr before & after each appointment
  SLOT_INTERVAL_MINUTES: 30,    // Show slots every 30 min
  BOOKING_WINDOW_DAYS: 60,      // How far ahead clients can book
  MIN_ADVANCE_DAYS: 2,          // Must book at least 2 calendar days in advance
  CACHE_SECONDS: 300,           // Cache calendar data for 5 minutes

  ANALYTICS_SHEET: 'Analytics'  // Google Sheet name for analytics data
};

// ============ HTTP HANDLERS ============

function doGet(e) {
  var p = e.parameter;
  var result;

  try {
    switch (p.action) {
      case 'month':
        // Returns availability + all slots for every day in one call
        result = getMonthWithSlots(
          parseInt(p.year), parseInt(p.month), parseInt(p.duration)
        );
        break;
      case 'slots':
        // Kept for backward compatibility but no longer needed
        result = getAvailableSlots(p.date, parseInt(p.duration));
        break;
      case 'analytics':
        // Returns aggregated analytics for the dashboard
        result = getAnalyticsData(p.days ? parseInt(p.days) : 30);
        break;
      default:
        result = { error: 'Unknown action' };
    }
  } catch (err) {
    result = { error: err.message };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var result;
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.type === 'analytics') {
      // Analytics beacon — log and return quickly
      result = logAnalyticsEvent(data);
    } else {
      // Booking request
      result = createBooking(data);
    }
  } catch (err) {
    result = { error: err.message };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============ HELPERS ============

function getBusinessHours(dayOfWeek) {
  return CONFIG.BUSINESS_HOURS[dayOfWeek] || null;
}

/** Fetch all events in a date range and return as {start,end} ms pairs.
 *  Uses CacheService to avoid repeated Calendar API calls (5 min TTL). */
function getBusyPeriods(rangeStart, rangeEnd) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'busy_' + rangeStart.getTime() + '_' + rangeEnd.getTime();
  var cached = cache.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  var cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  var events = cal.getEvents(rangeStart, rangeEnd);
  var busy = [];
  for (var i = 0; i < events.length; i++) {
    busy.push({
      start: events[i].getStartTime().getTime(),
      end:   events[i].getEndTime().getTime()
    });
  }

  // Cache for 5 minutes (Apps Script cache limit is 6hrs / 21600s)
  try {
    cache.put(cacheKey, JSON.stringify(busy), CONFIG.CACHE_SECONDS);
  } catch (e) { /* cache put can fail if data too large — that's fine */ }

  return busy;
}

/** Check whether [slotStart‑buffer, slotStart+duration+buffer] is free. */
function isSlotFree(slotStartMs, durationMin, busyPeriods) {
  var buf = CONFIG.BUFFER_MINUTES * 60000;
  var dur = durationMin * 60000;
  var blockStart = slotStartMs - buf;
  var blockEnd   = slotStartMs + dur + buf;

  for (var i = 0; i < busyPeriods.length; i++) {
    if (blockStart < busyPeriods[i].end && blockEnd > busyPeriods[i].start) {
      return false;
    }
  }
  return true;
}

// ============ COMBINED MONTH + SLOTS (single API call) ============

/**
 * Returns { availability: { "2026-03-05": true, … },
 *           slots:        { "2026-03-05": ["09:00","09:30",…], … } }
 * One call gives the client everything needed — no second fetch.
 */
function getMonthWithSlots(year, month, durationMin) {
  var lastDay  = new Date(year, month, 0);
  var numDays  = lastDay.getDate();

  var busy = getBusyPeriods(
    new Date(year, month - 1, 1, 0, 0, 0),
    new Date(year, month - 1, numDays, 23, 59, 59)
  );

  var now = new Date();
  var today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // 2 calendar days: if today is Mon, earliest bookable is Wed (all slots)
  var earliest = new Date(now);
  earliest.setDate(earliest.getDate() + CONFIG.MIN_ADVANCE_DAYS);
  earliest.setHours(0, 0, 0, 0);

  var maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + CONFIG.BOOKING_WINDOW_DAYS);

  var availability = {};
  var allSlots = {};

  for (var d = 1; d <= numDays; d++) {
    var date = new Date(year, month - 1, d);
    var key  = year + '-' + pad(month) + '-' + pad(d);

    if (date < today || date > maxDate) { availability[key] = false; continue; }

    var hours = getBusinessHours(date.getDay());
    if (!hours) { availability[key] = false; continue; }

    var daySlots = [];
    for (var h = hours.start; h < hours.end; h++) {
      for (var m = 0; m < 60; m += CONFIG.SLOT_INTERVAL_MINUTES) {
        var st  = new Date(year, month - 1, d, h, m, 0);
        if (st < earliest) continue;
        var end = new Date(st.getTime() + durationMin * 60000);
        if (end > new Date(year, month - 1, d, hours.end, 0, 0)) continue;
        if (isSlotFree(st.getTime(), durationMin, busy)) {
          daySlots.push(pad(h) + ':' + pad(m));
        }
      }
    }
    availability[key] = daySlots.length > 0;
    if (daySlots.length > 0) allSlots[key] = daySlots;
  }

  return { availability: availability, slots: allSlots };
}

// ============ TIME SLOTS FOR A DATE (backward compat) ============

function getAvailableSlots(dateStr, durationMin) {
  var p = dateStr.split('-');
  var year = parseInt(p[0]), month = parseInt(p[1]) - 1, day = parseInt(p[2]);

  var hours = getBusinessHours(new Date(year, month, day).getDay());
  if (!hours) return { slots: [] };

  var busy = getBusyPeriods(
    new Date(year, month, day, 0, 0, 0),
    new Date(year, month, day, 23, 59, 59)
  );

  var earliest = new Date();
  earliest.setDate(earliest.getDate() + CONFIG.MIN_ADVANCE_DAYS);
  earliest.setHours(0, 0, 0, 0);

  var slots = [];
  for (var h = hours.start; h < hours.end; h++) {
    for (var m = 0; m < 60; m += CONFIG.SLOT_INTERVAL_MINUTES) {
      var st  = new Date(year, month, day, h, m, 0);
      if (st < earliest) continue;
      var end = new Date(st.getTime() + durationMin * 60000);
      if (end > new Date(year, month, day, hours.end, 0, 0)) continue;
      if (isSlotFree(st.getTime(), durationMin, busy)) {
        slots.push(pad(h) + ':' + pad(m));
      }
    }
  }
  return { slots: slots };
}

// ============ CREATE BOOKING ============

function createBooking(data) {
  // data: { date, time, service, duration, name, email, phone, notes, paypalOrderId }

  var dp = data.date.split('-'), tp = data.time.split(':');
  var year = parseInt(dp[0]), month = parseInt(dp[1]) - 1, day = parseInt(dp[2]);
  var hour = parseInt(tp[0]), minute = parseInt(tp[1]);

  var startTime  = new Date(year, month, day, hour, minute, 0);
  var durMs      = data.duration * 60000;
  var bufMs      = CONFIG.BUFFER_MINUTES * 60000;
  var endTime    = new Date(startTime.getTime() + durMs);

  // Enforce 2 calendar day advance booking
  var earliest = new Date();
  earliest.setDate(earliest.getDate() + CONFIG.MIN_ADVANCE_DAYS);
  earliest.setHours(0, 0, 0, 0);
  if (startTime < earliest) {
    return { success: false, error: 'Bookings must be made at least 2 days in advance.' };
  }

  // Re-check availability (someone else may have booked while they were paying)
  var busy = getBusyPeriods(
    new Date(year, month, day, 0, 0, 0),
    new Date(year, month, day, 23, 59, 59)
  );
  if (!isSlotFree(startTime.getTime(), data.duration, busy)) {
    return { success: false, error: 'This time slot is no longer available. Please choose another.' };
  }

  var cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);

  // 1️⃣ Buffer BEFORE
  cal.createEvent(
    '\u23F3 Prep Buffer - ' + data.service,
    new Date(startTime.getTime() - bufMs),
    startTime,
    { description: 'Preparation buffer before ' + data.service + ' with ' + data.name }
  );

  // 2️⃣ Main appointment
  cal.createEvent(
    data.service + ' \u2014 ' + data.name,
    startTime,
    endTime,
    {
      description:
        'Service: ' + data.service + '\n' +
        'Client: '  + data.name + '\n' +
        'Email: '   + data.email + '\n' +
        'Phone: '   + (data.phone || 'Not provided') + '\n' +
        'Notes: '   + (data.notes || 'None') + '\n' +
        '---\n' +
        'PayPal Order: ' + (data.paypalOrderId || 'N/A') + '\n' +
        'Booked via website on ' + new Date().toLocaleString()
    }
  );

  // 3️⃣ Buffer AFTER
  cal.createEvent(
    '\u23F3 Follow-up Buffer - ' + data.service,
    endTime,
    new Date(endTime.getTime() + bufMs),
    { description: 'Follow-up buffer after ' + data.service + ' with ' + data.name }
  );

  return {
    success: true,
    message: 'Booking confirmed! ' + data.service + ' on ' + data.date + ' at ' + data.time
  };
}

// ============ UTILITY ============
function pad(n) { return ('0' + n).slice(-2); }

// ============ ANALYTICS — LOG EVENTS ============

/**
 * Ensures the Analytics sheet exists and has headers.
 * Returns the Sheet object.
 */
function getOrCreateAnalyticsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // If no spreadsheet is bound, create one
  if (!ss) {
    ss = SpreadsheetApp.create('Royal Color Analytics');
    PropertiesService.getScriptProperties().setProperty('ANALYTICS_SHEET_ID', ss.getId());
  }

  var sheet = ss.getSheetByName(CONFIG.ANALYTICS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.ANALYTICS_SHEET);
    sheet.appendRow([
      'Timestamp', 'Date', 'Event', 'Page', 'URL', 'Data',
      'Referrer', 'Screen', 'SessionId', 'VisitorId'
    ]);
    sheet.setFrozenRows(1);
    sheet.getRange('1:1').setFontWeight('bold');
  }
  return sheet;
}

/**
 * Writes one analytics event row to the sheet.
 * Called from doPost when data.type === 'analytics'.
 */
function logAnalyticsEvent(data) {
  try {
    var sheet = getOrCreateAnalyticsSheet();
    var ts  = data.timestamp || new Date().toISOString();
    var day = ts.substring(0, 10);  // "2026-03-03"

    sheet.appendRow([
      ts,
      day,
      data.event    || '',
      data.page     || '',
      data.url      || '',
      typeof data.data === 'object' ? JSON.stringify(data.data) : (data.data || ''),
      data.referrer || '',
      data.screen   || '',
      data.sessionId || '',
      data.visitorId || ''
    ]);

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ============ ANALYTICS — READ / AGGREGATE ============

/**
 * Returns aggregated analytics for the last N days.
 * Called from doGet with action=analytics&days=30
 */
function getAnalyticsData(days) {
  var sheet;
  try {
    sheet = getOrCreateAnalyticsSheet();
  } catch (e) {
    return { error: 'Analytics sheet not available: ' + e.message };
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { pageviews: [], events: [], topPages: [], visitors: 0, sessions: 0 };
  }

  var data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();

  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  var cutoffStr = Utilities.formatDate(cutoff, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  // Accumulators
  var pvByDay     = {};   // { "2026-03-01": count }
  var eventCounts = {};   // { "quiz_start": count }
  var pageCounts  = {};   // { "/index.html": count }
  var visitors    = {};
  var sessions    = {};
  var referrers   = {};
  var bookingFunnel = { service: 0, datetime: 0, details: 0, payment: 0, complete: 0 };

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var day    = (row[1] || '').toString();
    if (day < cutoffStr) continue;

    var event  = (row[2] || '').toString();
    var page   = (row[3] || '').toString();
    var url    = (row[4] || '').toString();
    var evData = (row[5] || '').toString();
    var ref    = (row[6] || '').toString();
    var sid    = (row[8] || '').toString();
    var vid    = (row[9] || '').toString();

    // Page views by day
    if (event === 'pageview') {
      pvByDay[day] = (pvByDay[day] || 0) + 1;
      pageCounts[url || '/'] = (pageCounts[url || '/'] || 0) + 1;
    }

    // Event counts
    if (event && event !== 'pageview' && event !== 'scroll_depth') {
      eventCounts[event] = (eventCounts[event] || 0) + 1;
    }

    // Booking funnel
    if (event === 'booking_step') {
      if (bookingFunnel.hasOwnProperty(evData)) {
        bookingFunnel[evData]++;
      }
    }
    if (event === 'booking_complete') {
      bookingFunnel.complete++;
    }

    // Unique visitors & sessions
    if (vid) visitors[vid] = true;
    if (sid) sessions[sid] = true;

    // Referrers
    if (ref) {
      try {
        var host = ref.replace(/https?:\/\//, '').split('/')[0];
        if (host && host.indexOf('royalcolor') === -1) {
          referrers[host] = (referrers[host] || 0) + 1;
        }
      } catch (e) {}
    }
  }

  // Build sorted arrays
  var pvArr = [];
  for (var d in pvByDay) pvArr.push({ date: d, views: pvByDay[d] });
  pvArr.sort(function (a, b) { return a.date < b.date ? -1 : 1; });

  var topPagesArr = [];
  for (var p in pageCounts) topPagesArr.push({ page: p, views: pageCounts[p] });
  topPagesArr.sort(function (a, b) { return b.views - a.views; });

  var evArr = [];
  for (var ev in eventCounts) evArr.push({ event: ev, count: eventCounts[ev] });
  evArr.sort(function (a, b) { return b.count - a.count; });

  var refArr = [];
  for (var r in referrers) refArr.push({ source: r, count: referrers[r] });
  refArr.sort(function (a, b) { return b.count - a.count; });

  return {
    pageviews:     pvArr,
    topPages:      topPagesArr.slice(0, 10),
    events:        evArr,
    referrers:     refArr.slice(0, 10),
    bookingFunnel: bookingFunnel,
    visitors:      Object.keys(visitors).length,
    sessions:      Object.keys(sessions).length,
    days:          days
  };
}
