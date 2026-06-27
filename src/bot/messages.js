// All message templates for the bot
// English and Hindi versions
// Usage: MESSAGES.hi.welcome or MESSAGES.en.welcome

const MESSAGES = {
  hi: {
    welcome: `🍎 *HP Apple Spray Advisory*
नमस्ते! मैं आपका Apple Spray सलाहकार हूँ।

मैं आपको:
✅ सही समय पर spray की सलाह
✅ मौसम के हिसाब से अलर्ट
✅ Spray log track करने में
मदद करूँगा।

पंजीकरण करने के लिए, अपना पूरा नाम लिखें:`,

    ask_village: `धन्यवाद {name} जी! 🙏

आपका गाँव / क्षेत्र का नाम बताएं:
_(उदाहरण: Rohru, Thanedar, Khamadi, Kotkhai)_`,

    ask_district: `जिला बताएं:
_(उदाहरण: Shimla, Kullu, Mandi, Kinnaur)_`,

    ask_area: `आपके बागीचे का रकबा कितना है?
_(बीघे में लिखें, जैसे: 5)_`,

    ask_altitude: `आपका बागीचा कितनी ऊंचाई पर है?
कोई एक विकल्प चुनें:

1️⃣ कम ऊंचाई (1800m से कम) - निचले क्षेत्र
2️⃣ मध्य ऊंचाई (1800-2600m) - Shimla/Kullu
3️⃣ अधिक ऊंचाई (2600m से अधिक) - Kinnaur/Lahaul

*1, 2, या 3 लिखें*`,

    ask_variety: `मुख्य किस्म बताएं:
_(उदाहरण: Royal Delicious, Red Delicious, Gala, Fuji, Golden Delicious)_`,

    ask_irrigation: `सिंचाई का प्रकार:

1️⃣ Drip Irrigation
2️⃣ Flood/Furrow
3️⃣ कोई सिंचाई नहीं (बारिश पर निर्भर)

*1, 2, या 3 लिखें*`,

    ask_stage: `अभी आपके बागीचे में कौन सी अवस्था है?

1️⃣ Dormant / Half Inch (सर्दियों में)
2️⃣ Green Tip
3️⃣ Pink Bud
4️⃣ Petal Fall / Full Bloom
5️⃣ Post Bloom (अखरोट जितना फल)
6️⃣ Fruit Dev - पहले 20 दिन
7️⃣ Fruit Dev - दूसरे 20 दिन
8️⃣ Pre Harvest
9️⃣ After Harvest

*1-9 में से नंबर लिखें*`,

    onboarding_complete: `✅ *पंजीकरण पूरा हुआ!*

{name} जी, आपकी जानकारी सेव हो गई।

अब आप ये कर सकते हैं:
• *SPRAY* - आज की spray सलाह
• *STAGE* - Growth stage बदलें
• *LOG* - Spray log करें
• *HELP* - मदद

कोई भी keyword लिखें शुरू करने के लिए 👇`,

    spray_header: `🌿 *Spray Advisory - {stage_name}*
📅 {date}

⚠️ *मौसम जाँच करें:* {weather_note}

*Disease Sprays:*`,

    spray_item: `• *{active_ingredient}*
  Brand: {brand_names}
  Dose: {dose} per 200L
  Targets: {targets}`,

    spray_footer: `\n📝 Spray करने के बाद LOG लिखें।
📌 *{ban_warning}*`,

    log_ask_date: `Spray किस तारीख को किया?
_(आज के लिए TODAY लिखें, या DD/MM/YYYY)_`,

    log_ask_chemical: `कौन सा chemical / दवाई use किया?
_(Brand name या active ingredient लिखें)_`,

    log_saved: `✅ Spray log save हो गया!
📅 {date} | {stage}

अगली spray की याद दिलाएंगे।`,

    weather_alert_rain: `🌧️ *बारिश Alert!*
{orchard_id} - पिछले 12 घंटों में {rainfall}mm बारिश।

अगर आपने हाल में spray किया था, तो दोबारा spray की जरूरत हो सकती है।`,

    weather_alert_scab: `⚠️ *Scab Infection Warning!*
तापमान 13-24°C और पत्तियाँ {hours}+ घंटे गीली रहीं।

*तुरंत Scab Spray करें!*
सिफारिश: Dithianon या Captan (अगर आप उपयोग करते हैं)`,

    not_understood: `माफ कीजिए, समझ नहीं आया।

*SPRAY* - Spray सलाह पाएं
*STAGE* - Stage बदलें
*LOG* - Spray log करें
*HELP* - सभी commands`,
  },

  en: {
    welcome: `🍎 *HP Apple Spray Advisory*
Welcome! I'm your Apple Spray Advisor.

I'll help you with:
✅ Timely spray recommendations
✅ Weather-based alerts
✅ Spray schedule tracking

To register, please tell me your full name:`,

    ask_village: `Thank you {name}!

What is your village/area?
_(e.g. Rohru, Thanedar, Khamadi, Kotkhai)_`,

    ask_district: `Which district?
_(e.g. Shimla, Kullu, Mandi, Kinnaur)_`,

    ask_area: `How many bighas is your orchard?
_(Just the number, e.g.: 5)_`,

    ask_altitude: `What altitude is your orchard at?
Choose one:

1️⃣ Low (<1800m) - Lower valleys
2️⃣ Mid (1800-2600m) - Shimla/Kullu belt
3️⃣ High (>2600m) - Kinnaur/Lahaul

*Type 1, 2, or 3*`,

    ask_variety: `What is your primary apple variety?
_(e.g. Royal Delicious, Gala, Fuji, Golden Delicious)_`,

    ask_irrigation: `Type of irrigation?

1️⃣ Drip Irrigation
2️⃣ Flood/Furrow
3️⃣ None (rain-fed)

*Type 1, 2, or 3*`,

    ask_stage: `What growth stage is your orchard at currently?

1️⃣ Dormant / Half Inch (winter)
2️⃣ Green Tip
3️⃣ Pink Bud
4️⃣ Petal Fall / Full Bloom
5️⃣ Post Bloom (walnut size)
6️⃣ Fruit Dev - first 20 days
7️⃣ Fruit Dev - second 20 days
8️⃣ Pre Harvest
9️⃣ After Harvest

*Type 1-9*`,

    onboarding_complete: `✅ *Registration complete!*

{name}, your profile is saved.

Commands:
• *SPRAY* - Get today's spray advice
• *STAGE* - Update growth stage
• *LOG* - Log a spray
• *HELP* - All commands`,

    spray_header: `🌿 *Spray Advisory - {stage_name}*
📅 {date}

⚠️ *Weather check:* {weather_note}

*Disease Sprays:*`,

    spray_item: `• *{active_ingredient}*
  Brand: {brand_names}
  Dose: {dose} per 200L
  Targets: {targets}`,

    spray_footer: `\n📝 Reply LOG after spraying to record it.
📌 *{ban_warning}*`,

    log_ask_date: `When did you spray?
_(Type TODAY or DD/MM/YYYY)_`,

    log_ask_chemical: `Which chemical/product did you use?`,

    log_saved: `✅ Spray logged!
📅 {date} | {stage}

We'll remind you for the next spray.`,

    weather_alert_rain: `🌧️ *Rain Alert!*
{rainfall}mm rain in last 12 hours.

If you sprayed recently, re-application may be needed.`,

    weather_alert_scab: `⚠️ *Scab Infection Warning!*
Temp 13-24°C + leaf wetness for {hours}+ hours.

*Spray immediately for Scab!*
Recommended: Dithianon`,

    not_understood: `Sorry, didn't understand that.

*SPRAY* - Get spray advice
*STAGE* - Update stage
*LOG* - Log a spray
*HELP* - All commands`,
  }
};

// Stage name lookup — keys must exactly match stage_id values in hp_apple_spray_master.json
const STAGE_NAMES = {
  dormant_half_inch:        { hi: 'Dormant / Half Inch', en: 'Dormant / Half Inch', number: 1 },
  green_tip:                { hi: 'Green Tip', en: 'Green Tip', number: 2 },
  pink_bud:                 { hi: 'Pink Bud', en: 'Pink Bud', number: 3 },
  petal_fall:               { hi: 'Petal Fall / Full Bloom', en: 'Petal Fall / Full Bloom', number: 4 },
  fruit_dev_walnut:         { hi: 'Post Bloom (अखरोट जितना फल)', en: 'Post Bloom (walnut size)', number: 5 },
  fruit_dev_20days:         { hi: 'Fruit Dev - पहले 20 दिन', en: 'Fruit Dev - first 20 days', number: 6 },
  fruit_dev_second20days:   { hi: 'Fruit Dev - दूसरे 20 दिन', en: 'Fruit Dev - second 20 days', number: 7 },
  pre_harvest:              { hi: 'Pre Harvest', en: 'Pre Harvest', number: 8 },
  after_harvest:            { hi: 'After Harvest', en: 'After Harvest', number: 9 },
};

// Map user input number (1-9) to stage_id — must match stage_id in hp_apple_spray_master.json
const STAGE_NUMBER_MAP = {
  '1': 'dormant_half_inch',
  '2': 'green_tip',
  '3': 'pink_bud',
  '4': 'petal_fall',
  '5': 'fruit_dev_walnut',
  '6': 'fruit_dev_20days',
  '7': 'fruit_dev_second20days',
  '8': 'pre_harvest',
  '9': 'after_harvest',
};

const ALTITUDE_MAP = {
  '1': { zone: 'low',  label: 'Low (<1800m)',   approx_m: 1500 },
  '2': { zone: 'mid',  label: 'Mid (1800-2600m)', approx_m: 2200 },
  '3': { zone: 'high', label: 'High (>2600m)',   approx_m: 2800 },
};

const IRRIGATION_MAP = {
  '1': 'drip',
  '2': 'flood',
  '3': 'none',
};

// Simple template engine: replaces {key} with values object
function format(template, values = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? `{${key}}`);
}

module.exports = { MESSAGES, STAGE_NAMES, STAGE_NUMBER_MAP, ALTITUDE_MAP, IRRIGATION_MAP, format };
