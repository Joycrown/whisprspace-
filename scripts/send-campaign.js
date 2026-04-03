/**
 * WhisprSpace — Email Campaign Sender
 * Uses Brevo (Sendinblue) Transactional Email API
 *
 * Usage:
 *   node scripts/send-campaign.js
 *
 * To run a dry-run (no emails sent):
 *   DRY_RUN=true node scripts/send-campaign.js
 *
 * Fill in RECIPIENTS below before running.
 */

require('dotenv').config({ path: '.env.local' })
const https = require('https')

// ─────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────
const API_KEY = process.env.BREVO_TRANSACTIONAL_API_KEY
const SENDER_EMAIL = process.env.EMAIL_SENDER || 'admin@whisprspace.com'
const SENDER_NAME = process.env.EMAIL_SENDER_NAME || 'WhisprSpace'
const DRY_RUN = process.env.DRY_RUN === 'true'
const DELAY_MS = 200 // delay between sends to stay within Brevo rate limits

// ─────────────────────────────────────────────
//  RECIPIENTS  ← add email addresses here
// ─────────────────────────────────────────────
// ⚠️  Duplicate-name flags (both kept — may be different accounts):
//   Kelvin Njenga    → kelvynkamonya007@gmail.com + njenga.mentor@gmail.com
//   Mary Oladinrin   → moladinrin@gmail.com + maryoladinrin@gmail.com
//   Gideon Obadare   → obadareolaoluwa20@gmail.com + obadaregideon@gmail.com
// ✅  Typo fixed: uwaemesamuel5@gmil.com → uwaemesamuel5@gmail.com
// ❌  Excluded: olaniyanayoade999@gmail.com (already received test)

const RECIPIENTS = [
  { email: 'boluwatifefaith510@gmail.com', name: 'Boluwatife' },
  { email: 'michaelolaomi94@gmail.com', name: 'Michael' },
  { email: 'nyagakavera@gmail.com', name: 'Vera' },
  { email: 'deyfunky26@gmail.com', name: 'Precious' },
  { email: 'oyeniyiglory3@gmail.com', name: 'Glory' },
  { email: 'oshinbolubrian@gmail.com', name: 'Brian' },
  { email: 'akhere4jfc@gmail.com', name: 'Rebecca' },
  { email: 'olaoluwakitan001@gmail.com', name: 'Oluwafemi' },
  { email: 'ooolaniyan20@gmail.com', name: 'Oluwakemi' },
  { email: 'emmanuellaadio@gmail.com', name: 'Emmanuella' },
  { email: 'hardeysanyaizzy@gmail.com', name: 'Israel' },
  { email: 'yahmas4real@gmail.com', name: 'Peince' },
  { email: 'nike39315@gmail.com', name: 'Nike' },
  { email: 'oluwabusayomi254@gmail.com', name: 'Oluwabusayomi' },
  { email: 'roolubayo@gmail.com', name: 'Ro' },
  { email: 'adepojuboluwatife879@gmail.com', name: 'Boluwatife' },
  { email: 'diyamba27@gmail.com', name: 'Desmond' },
  { email: 'viaife@yahoo.co.uk', name: 'Ifeoluwa' },
  { email: 'johnsonkolawole28@gmail.com', name: 'Johnson' },
  { email: 'hasanatayoka@gmail.com', name: 'Folawiyo' },
  { email: 'oluola109@gmail.com', name: 'Olumide' },
  { email: 'bjohnjaja86@gmail.com', name: 'Blessing' },
  { email: 'engremmanuel90@gmail.com', name: 'Emmanuel' },
  { email: 'olaniponoluwadunsin15@gmail.com', name: 'Olanipon' },
  { email: 'omolaraadewunmi95@gmail.com', name: 'Omolara' },
  { email: 'solfagfx2018@gmail.com', name: 'Fagbamigbe' },
  { email: 'bukolaajike25@gmail.com', name: 'Bukola' },
  { email: 'oluwatobisimiilori06@gmail.com', name: 'Oluwatobisimi' },
  { email: 'babalolafathia16@gmail.com', name: 'Fathia' },
  { email: 'olaniyichristy17@gmail.com', name: 'Olaniyi' },
  { email: 'oluwatosinemmanuela@gmail.com', name: 'Oluwatosin' },
  { email: 'ayenifunmilayo512@gmail.com', name: 'Funmilayo' },
  { email: 'lawalfareeda19@gmail.com', name: 'Fareedah' },
  { email: 'asakebusuyi22@gmail.com', name: 'Busuyi' },
  { email: 'aderonkeadedoyin1@gmail.com', name: 'Aderonke' },
  { email: 'estheradeolaadesina222@gmail.com', name: 'Esther' },
  { email: 'esthergandonou05@gmail.com', name: 'Esther' },
  { email: 'aishatshomade.b@gmail.com', name: "A'ishat" },
  { email: 'omolaraabyoms@yahoo.com', name: 'Omolara' },
  { email: 'premierayibapreye@gmail.com', name: 'Preye' },
  { email: 'rita4wanogho@gmail.com', name: 'Rita' },
  { email: 'abimboladavid5@gmail.com', name: 'Abimbola' },
  { email: 'nyakoremo@gmail.com', name: 'Emma' },
  { email: 'veectoriandiets@gmail.com', name: 'Kalu' },
  { email: 'luluhandbags1@gmail.com', name: 'Oluchi' },
  { email: 'mmabotseboutique@gmail.com', name: 'Lerato' },
  { email: 'eddoayokunle2020@gmail.com', name: 'Edso' },
  { email: 'kelvynkamonya007@gmail.com', name: 'Kelvin' },
  { email: 'adedolapodeborah8@gmail.com', name: 'Deborah' },
  { email: 'lucasdavidd101@gmail.com', name: 'David' },
  { email: 'jibeh69@gmail.com', name: 'Joy' },
  { email: 'asaoludorcas7@gmail.com', name: 'Dorcas' },
  { email: 'kolawoleprecious234@gmail.com', name: 'Kolawole' },
  { email: 'babatundejoshua063@gmail.com', name: 'Oluwasegun' },
  { email: 'oluwaferanmimayowa739@gmail.com', name: 'Mayowa' },
  { email: 'hassanboy450@gmail.com', name: 'Mohammed' },
  { email: 'lanredavidobashoro@gmail.com', name: 'Lanre' },
  { email: 'hypemanjoker@gmail.com', name: 'Adu' },
  { email: 'georgemodupella@gmail.com', name: 'Modupe' },
  { email: 'jimohbarakatopeyemi054@gmail.com', name: 'Barakat' },
  { email: 'oyedelemercy208@gmail.com', name: 'Mercy' },
  { email: 'dharmmiey2001@gmail.com', name: 'Ayodabo' },
  { email: 'olaifaifeoluwa2018@gmail.com', name: 'Ifeoluwa' },
  { email: 'obadareolaoluwa20@gmail.com', name: 'Gideon' },
  { email: 'evescakesandevents@gmail.com', name: 'Paulina' },
  { email: 'isaiahdada2025@gmail.com', name: 'Isaiah' },
  { email: 'tobiloba.akinbobola@gmail.com', name: 'Oluwatobiloba' },
  { email: 'zainabsalawu9@gmail.com', name: 'Olajumoke' },
  { email: 'moladinrin@gmail.com', name: 'Mary' },
  { email: 'olorunsolagrace9@gmail.com', name: 'Grace' },
  { email: 'shittu488@gmail.com', name: 'Shittu' },
  { email: 'adelajajoseph04@gmail.com', name: 'Joseph' },
  { email: 'iamcalledangel@gmail.com', name: 'Angel' },
  { email: 'adeoyemoses2001@gmail.com', name: 'Adeoye' },
  { email: 'joshuaogundiran2000@gmail.com', name: 'Joshua' },
  { email: 'maryoluwatosin163@gmail.com', name: 'Mary' },
  { email: 'uwaemesamuel5@gmail.com', name: 'Samuel' },
  { email: 'tiwes2008@gmail.com', name: 'Oyeleye' },
  { email: 'dexmiragejidex@gmail.com', name: 'Daniel' },
  { email: 'omotoyosioderinde9@gmail.com', name: 'Omotoyosi' },
  { email: 'njenga.mentor@gmail.com', name: 'Kelvin' },
  { email: 'alimikhenaoshiole@gmail.com', name: 'Grace' },
  { email: 'johngracebere@gmail.com', name: 'John' },
  { email: 'oyinade.adebukky@gmail.com', name: 'Honeycrown' },
  { email: 'lotuslogue@gmail.com', name: 'Lotus' },
  { email: 'rubbytech1@gmail.com', name: 'Timilehin' },
  { email: 'obisesanmarvelous52@gmail.com', name: 'Aanuoluwapo' },
  { email: 'olowogbadebabatunde@gmail.com', name: 'Babatunde' },
  { email: 'uyihindavid@gmail.com', name: 'David' },
  { email: 'molatunji772@gmail.com', name: 'Michael' },
  { email: 'oluomachiukanwa32@gmail.com', name: 'Prisca' },
  { email: 'prettyjoyee2004@gmail.com', name: 'Joy' },
  { email: 'adedejijohnson00@gmail.com', name: 'Johnson' },
  { email: 'olabodejohn943@gmail.com', name: 'John' },
  { email: 'lawaltosine01@gmail.com', name: 'Oluwatomisin' },
  { email: 'alimikhenaoshione@gmail.com', name: 'Oshione' },
  { email: 'funmilayomary880@gmail.com', name: 'Funmilayo' },
  { email: 'obideyioluwapelumi@gmail.com', name: 'Oluwapelumi' },
  { email: 'ttfashlayo@gmail.com', name: 'Titilayo' },
  { email: 'daramolamary02@gmail.com', name: 'Temitayo' },
  { email: 'amehqueen1998@gmail.com', name: 'Queen' },
  { email: 'frankpy93@gmail.com', name: 'Franklin' },
  { email: 'ogunbowaleaduragbemib@gmail.com', name: 'Aduragbemi' },
  { email: 'maryamkanyinsola2706@gmail.com', name: 'Maryam' },
  { email: 'chiomaprincess023@gmail.com', name: 'Chioma' },
  { email: 'fvckallyovhoes@gmail.com', name: 'Afeez' },
  { email: 'fagbohuneunice@gmail.com', name: 'Eunice' },
  { email: 'okorosc910@gmail.com', name: 'Chidiogo' },
  { email: 'temitopeoyinloye98@gmail.com', name: 'Temitope' },
  { email: 'uhaaeverest@gmail.com', name: 'Everest' },
  { email: 'oladosuemmax404@gmail.com', name: 'Oladosu' },
  { email: 'aweboluwatifepius@gmail.com', name: 'Boluwatife' },
  { email: 'giftthev.a@gmail.com', name: 'Jojo' },
  { email: 'zephaniahjacob@gmail.com', name: 'Zephaniah' },
  { email: 'maryoladinrin@gmail.com', name: 'Mary' },
  { email: 'opeoluwayomi@gmail.com', name: 'Opeoluwa' },
  { email: 'obadaregideon@gmail.com', name: 'Gideon' },
  { email: 'omobolanleeniola375@gmail.com', name: 'Omobolanle' },
  { email: 'worthyprints23@gmail.com', name: 'Worthy' },
  { email: 'victoriadamilola67@gmail.com', name: 'Victoria' },
  // — Batch 2 (40) —
  { email: 'victoryolamide16@gmail.com', name: '' },
  { email: 'agyasgodsent8@gmail.com', name: 'Godsent' },
  { email: 'franklinowums@gmail.com', name: '' },
  { email: 'mammanaaron@gmail.com', name: 'Taahiro' },
  { email: 'abdulazeezharuna9116@gmail.com', name: 'Haruna' },
  { email: 'mosesagnesonyamu@gmail.com', name: '' },
  { email: 'isongvictor2@gmail.com', name: '' },
  { email: 'yusirat247@gmail.com', name: 'Yusirat' },
  { email: 'cynthiaamarachi15@gmail.com', name: '' },
  { email: 'theophilusangwe88@gmail.com', name: '' },
  { email: 'azubuineugonma05@gmail.com', name: 'Glory' },
  { email: 'dorislawal4@gmail.com', name: '' },
  { email: 'eblessing667@gmail.com', name: '' },
  { email: 'toriadeadetutu@gmail.com', name: '' },
  { email: 'cynthiaukawu@gmail.com', name: '' },
  { email: 'kabirahaduniade@gmail.com', name: '' },
  { email: 'abdulraheemmuhammed451@gmail.com', name: 'Muhammed' },
  { email: 'puraycreation@gmail.com', name: 'Prince' },
  { email: 'ogunmukooluwapelumi@gmail.com', name: '' },
  { email: 'omobolanletaofeek081@gmail.com', name: 'Taofeek' },
  { email: 'adesinaestheradeola@gmail.com', name: '' },
  { email: 'otumercyoluchi2017@gmail.com', name: '' },
  { email: 'viviananyango854@gmail.com', name: 'Vivian' },
  { email: 'deeyahssignatures@gmail.com', name: '' },
  { email: 'oginnielizabeth05@gmail.com', name: '' },
  { email: 'ebi2012chalayadeta@gmail.com', name: 'Ebenezer' },
  { email: 'uwakmfonbenjamin003@gmail.com', name: 'Uwakmfon' },
  { email: 'ibukunzeal@gmail.com', name: '' },
  { email: 'tusneldelainae@gmail.com', name: 'Tusnelde' },
  { email: 'ayeshaatique123@gmail.com', name: 'Ayesha' },
  { email: 'ogungbamilaogbotemi@gmail.com', name: 'Ogbotemi' },
  { email: 'njenga.mungai007@gmail.com', name: '' },
  { email: 'rebeca4jc@gmail.com', name: 'Rebecca' },
  { email: 'akinyuniadedeke@gmail.com', name: 'Akinyunni' },
  { email: 'newmanblessing03@gmail.com', name: '' },
  { email: 'adekoyaoluwafumilayo3@gmail.com', name: 'Adekoya' },
  { email: 'miaangel450@gmail.com', name: '' },
  { email: 'betagabriel02@gmail.com', name: '' },
  { email: 'giftthev.a01@gmail.com', name: '' },
  { email: 'shalommayirensonapoleon@gmail.com', name: '' },
  // — Batch 3: Brevo waitlist (36 new) —
  { email: 'marcomokaro@gmail.com', name: 'Marc' },
  { email: 'olire96@gmail.com', name: 'Olamide' },
  { email: 'olayinkarodiat18@gmail.com', name: 'Deeyah' },
  { email: 'asuanthony457@gmail.com', name: 'Anthony' },
  { email: 'temmyalawode53@gmail.com', name: 'Alawode' },
  { email: 'ayanfeoluwadamilare11@gmail.com', name: 'Segun' },
  { email: 'obasitony1@gmail.com', name: 'Shedrack' },
  { email: 'mylittlrferita@gmail.com', name: 'Osinachi' },
  { email: 'esedereabraham@gmail.com', name: 'Abraham' },
  { email: 'mcjoshomotolani@gmail.com', name: 'Charles' },
  { email: 'kennyolajiggs@gmail.com', name: 'Kehinde' },
  { email: 'phigoupfront@gmail.com', name: 'Olayinka' },
  { email: 'favourtop121@gmail.com', name: 'Banjo' },
  { email: 'ayenidan638@gmail.com', name: 'Daniel' },
  { email: 'oladapodamiey@gmail.com', name: 'Oladapo' },
  { email: 'michaellegends150@gmail.com', name: 'Ajayi' },
  { email: 'onwukaezinneanne@gmail.com', name: 'Ezinne' },
  { email: 'adebayodaniel98@gmail.com', name: 'Daniel' },
  { email: 'anduagoziem@gmail.com', name: 'Anointed' },
  { email: 'supremeoptimal@gmail.com', name: 'Oluwatosin' },
  { email: 'danieloyinloye075@gmail.com', name: 'Daniel' },
  { email: 'thariqrasheed@gmail.com', name: 'Thariq' },
  { email: '17manojkumar.1@gmail.com', name: 'Manoj' },
  { email: 'beccandamilola@gmail.com', name: 'Opeyemi' },
  { email: 'okedelevictor99@gmail.com', name: 'Victor' },
  { email: 'gloryadesinaola126@gmail.com', name: 'Tiwalola' },
  { email: 'abigailibikunle488@gmail.com', name: 'Abigail' },
  { email: 'ebekeella27@gmail.com', name: 'Faith' },
  { email: 'owolafefunke@gmail.com', name: 'Owolafe' },
  { email: 'medikay7960@gmail.com', name: 'Kayode' },
  { email: 'ooolaniyan68@gmail.com', name: 'Olaniyan' },
  { email: 'oderindeomotoyosi9@gmail.com', name: 'Omotoyosi' },
  { email: 'korededelight@gmail.com', name: 'Emmanuel' },
  { email: 'yinusatimothy661@gmail.com', name: 'Timothy' },
  { email: 'carolinekemisola6@gmail.com', name: 'Caroline' },
  { email: 'ebiniabiye@gmail.com', name: 'Abiye' },
  { email: 'yetundeshanu574@gmail.com', name: 'Yetunde' },
  { email: 'whisprspaceofficial@gmail.com', name: 'WhisprSpace' },
]

// ─────────────────────────────────────────────
//  EMAIL CONTENT
// ─────────────────────────────────────────────
const SUBJECT = "Your space is ready — WhisprSpace is live"

/**
 * Build the HTML body for a specific recipient.
 * Replace any per-recipient placeholders here.
 */
function buildHtml(recipient) {
  const firstName = recipient.name ? recipient.name.split(' ')[0] : null
  const greeting = firstName ? `${firstName},` : 'Hey,'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>WhisprSpace is Live</title>
</head>
<body style="margin:0;padding:0;background-color:#0d0d12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;">

<!-- Preheader (hidden preview text) -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Say what you really mean. No name. No filter. WhisprSpace is live.</div>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0d0d12;">
<tr>
  <td align="center" style="padding:40px 16px 48px;">

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">

      <!-- NAV BAR -->
      <tr>
        <td style="padding-bottom:32px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;padding-right:10px;">
                      <img src="https://app.whisprspace.com/assets/ws-icon.png" width="28" height="28" alt="" style="display:block;border-radius:6px;" />
                    </td>
                    <td style="vertical-align:middle;">
                      <span style="font-size:15px;font-weight:700;letter-spacing:0.04em;color:#ffffff;">WhisprSpace</span>
                    </td>
                  </tr>
                </table>
              </td>
              <td align="right">
                <span style="display:inline-block;background:rgba(134,239,172,0.12);border:1px solid rgba(134,239,172,0.3);border-radius:100px;padding:5px 14px;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#86efac;">
                  &#9679;&nbsp; Live now
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- HERO CARD -->
      <tr>
        <td style="background:linear-gradient(135deg,#1e1333 0%,#16112b 50%,#0f1a2e 100%);border-radius:20px;overflow:hidden;padding:0;">
          <!-- top accent line -->
          <div style="height:3px;background:linear-gradient(90deg,#a855f7,#6366f1,#3b82f6);"></div>

          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:48px 44px 44px;">

                <!-- Eyebrow -->
                <p style="margin:0 0 20px;font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#a78bfa;">
                  Welcome to the space
                </p>

                <!-- Headline -->
                <h1 style="margin:0 0 20px;font-size:36px;font-weight:800;line-height:1.2;letter-spacing:-0.03em;color:#ffffff;">
                  Say what you<br/>
                  <span style="background:linear-gradient(90deg,#c084fc,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">really mean.</span>
                </h1>

                <!-- Sub -->
                <p style="margin:0 0 36px;font-size:16px;font-weight:400;line-height:1.75;color:#94a3b8;">
                  ${greeting} You're in — and the conversation has already started.<br/>
                  No name. No filter. Just raw, honest expression.
                </p>

                <!-- CTA Button -->
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="border-radius:10px;background:linear-gradient(135deg,#9333ea,#6366f1);">
                      <a href="https://app.whisprspace.com/threads" style="display:inline-block;padding:15px 32px;font-size:15px;font-weight:700;letter-spacing:0.01em;color:#ffffff;text-decoration:none;">
                        Enter WhisprSpace &rarr;
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:16px 0 0;font-size:12px;color:#475569;letter-spacing:0.02em;">
                  No real name required &nbsp;&middot;&nbsp; Anonymous by default
                </p>

              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- SPACER -->
      <tr><td style="height:12px;"></td></tr>

      <!-- LIVE THREADS -->
      <tr>
        <td style="background:#13131f;border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">

            <!-- Section header -->
            <tr>
              <td style="padding:18px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td>
                      <span style="font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;">Happening right now</span>
                    </td>
                    <td align="right">
                      <a href="https://app.whisprspace.com/threads" style="font-size:12px;font-weight:500;color:#818cf8;text-decoration:none;">See all &rarr;</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Thread 1 -->
            <tr>
              <td style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.05);">
                <a href="https://app.whisprspace.com/threads" style="text-decoration:none;display:block;">
                  <p style="margin:0 0 8px;font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#7c3aed;">Personal</p>
                  <p style="margin:0 0 12px;font-size:15px;font-weight:600;line-height:1.5;color:#e2e8f0;">I found out my dad has a second family a week before my wedding.</p>
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding-right:16px;">
                        <span style="font-size:12px;color:#475569;"><span style="color:#94a3b8;font-weight:600;">10</span> voices</span>
                      </td>
                      <td style="padding-right:16px;">
                        <span style="font-size:12px;color:#475569;"><span style="color:#94a3b8;font-weight:600;">9</span> perspectives</span>
                      </td>
                      <td>
                        <span style="font-size:11px;font-weight:600;color:#4ade80;letter-spacing:0.04em;">&#9679; Open</span>
                      </td>
                    </tr>
                  </table>
                </a>
              </td>
            </tr>

            <!-- Thread 2 -->
            <tr>
              <td style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.05);">
                <a href="https://app.whisprspace.com/threads" style="text-decoration:none;display:block;">
                  <p style="margin:0 0 8px;font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#0ea5e9;">Relationships</p>
                  <p style="margin:0 0 12px;font-size:15px;font-weight:600;line-height:1.5;color:#e2e8f0;">I found a &lsquo;secret life&rsquo; laptop in our new apartment.</p>
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding-right:16px;">
                        <span style="font-size:12px;color:#475569;"><span style="color:#94a3b8;font-weight:600;">5</span> voices</span>
                      </td>
                      <td style="padding-right:16px;">
                        <span style="font-size:12px;color:#475569;"><span style="color:#94a3b8;font-weight:600;">4</span> perspectives</span>
                      </td>
                      <td>
                        <span style="font-size:11px;font-weight:600;color:#4ade80;letter-spacing:0.04em;">&#9679; Open</span>
                      </td>
                    </tr>
                  </table>
                </a>
              </td>
            </tr>

            <!-- Footer note -->
            <tr>
              <td style="padding:16px 24px;background:rgba(99,102,241,0.06);">
                <a href="https://app.whisprspace.com/threads" style="text-decoration:none;">
                  <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
                    These conversations expire &mdash; <span style="color:#818cf8;font-weight:500;">join while they're still open</span>
                  </p>
                </a>
              </td>
            </tr>

          </table>
        </td>
      </tr>

      <!-- SPACER -->
      <tr><td style="height:12px;"></td></tr>

      <!-- FEATURES GRID — 2x2 -->
      <tr>
        <td>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>

              <!-- Feature 1 -->
              <td width="49%" style="background:#13131f;border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:24px;vertical-align:top;">
                <div style="width:40px;height:40px;background:linear-gradient(135deg,rgba(168,85,247,0.2),rgba(99,102,241,0.2));border-radius:10px;font-size:20px;text-align:center;line-height:40px;margin-bottom:14px;">💬</div>
                <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#e2e8f0;">Anonymous threads</p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Say what you've been holding back. No name attached.</p>
              </td>

              <td width="2%"></td>

              <!-- Feature 2 -->
              <td width="49%" style="background:#13131f;border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:24px;vertical-align:top;">
                <div style="width:40px;height:40px;background:linear-gradient(135deg,rgba(14,165,233,0.2),rgba(56,189,248,0.2));border-radius:10px;font-size:20px;text-align:center;line-height:40px;margin-bottom:14px;">📬</div>
                <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#e2e8f0;">Anonymous inbox</p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Share your link. Hear what people actually think.</p>
              </td>

            </tr>
            <tr><td colspan="3" style="height:8px;"></td></tr>
            <tr>

              <!-- Feature 3 -->
              <td width="49%" style="background:#13131f;border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:24px;vertical-align:top;">
                <div style="width:40px;height:40px;background:linear-gradient(135deg,rgba(16,185,129,0.2),rgba(52,211,153,0.2));border-radius:10px;font-size:20px;text-align:center;line-height:40px;margin-bottom:14px;">🔒</div>
                <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#e2e8f0;">Private rooms</p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Invite-only threads where only your words matter.</p>
              </td>

              <td width="2%"></td>

              <!-- Feature 4 -->
              <td width="49%" style="background:#13131f;border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:24px;vertical-align:top;">
                <div style="width:40px;height:40px;background:linear-gradient(135deg,rgba(245,158,11,0.2),rgba(251,191,36,0.2));border-radius:10px;font-size:20px;text-align:center;line-height:40px;margin-bottom:14px;">📊</div>
                <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#e2e8f0;">Anonymous polls</p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Vote honestly. See what people really think.</p>
              </td>

            </tr>
          </table>
        </td>
      </tr>

      <!-- SPACER -->
      <tr><td style="height:12px;"></td></tr>

      <!-- CLOSING CARD -->
      <tr>
        <td style="background:#13131f;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:36px 40px;text-align:center;">
          <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">You're early. That matters.</p>
          <p style="margin:0 0 28px;font-size:14px;line-height:1.8;color:#64748b;">
            This is still being shaped. The people who join now<br/>are the ones who define what WhisprSpace becomes.
          </p>
          <table cellpadding="0" cellspacing="0" border="0" align="center">
            <tr>
              <td style="border-radius:10px;border:1px solid rgba(129,140,248,0.4);">
                <a href="https://app.whisprspace.com/auth" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#818cf8;text-decoration:none;letter-spacing:0.01em;">
                  Create your account &rarr;
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- SPACER -->
      <tr><td style="height:32px;"></td></tr>

      <!-- FOOTER -->
      <tr>
        <td style="border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <span style="font-size:12px;font-weight:700;letter-spacing:0.06em;color:#94a3b8;">WhisprSpace</span>
              </td>
              <td align="right">
                <a href="https://whisprspace.com/privacy-policy" style="font-size:11px;color:#64748b;text-decoration:none;">Privacy Policy</a>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top:8px;">
                <p style="margin:0;font-size:11px;color:#64748b;line-height:1.6;">
                  You're receiving this because you signed up for WhisprSpace early access.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

    </table>
  </td>
</tr>
</table>

</body>
</html>`
}

// ─────────────────────────────────────────────
//  BREVO API CALL
// ─────────────────────────────────────────────
function sendEmail(recipient) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [recipient.name ? { email: recipient.email, name: recipient.name } : { email: recipient.email }],
      subject: SUBJECT,
      htmlContent: buildHtml(recipient),
    })

    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': API_KEY,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true, messageId: JSON.parse(data).messageId })
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`))
        }
      })
    })

    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────
async function main() {
  if (!API_KEY) {
    console.error('❌  BREVO_TRANSACTIONAL_API_KEY is not set in .env.local')
    process.exit(1)
  }

  if (RECIPIENTS.length === 0) {
    console.error('❌  No recipients — add email addresses to the RECIPIENTS array in this script.')
    process.exit(1)
  }

  console.log(`\n📧  WhisprSpace Campaign Send`)
  console.log(`    From:       ${SENDER_NAME} <${SENDER_EMAIL}>`)
  console.log(`    Subject:    ${SUBJECT}`)
  console.log(`    Recipients: ${RECIPIENTS.length}`)
  console.log(`    Mode:       ${DRY_RUN ? '🧪 DRY RUN (no emails sent)' : '🚀 LIVE'}`)
  console.log(`─────────────────────────────────────────`)

  let sent = 0
  let failed = 0

  for (let i = 0; i < RECIPIENTS.length; i++) {
    const recipient = RECIPIENTS[i]
    const label = `[${i + 1}/${RECIPIENTS.length}] ${recipient.email}`

    if (DRY_RUN) {
      console.log(`  ✓ DRY  ${label}`)
      sent++
      continue
    }

    try {
      const result = await sendEmail(recipient)
      console.log(`  ✓ SENT ${label}  (id: ${result.messageId})`)
      sent++
    } catch (err) {
      console.error(`  ✗ FAIL ${label}  → ${err.message}`)
      failed++
    }

    // rate limit — 200ms gap between sends
    if (i < RECIPIENTS.length - 1) {
      await sleep(DELAY_MS)
    }
  }

  console.log(`─────────────────────────────────────────`)
  console.log(`  Sent: ${sent}  |  Failed: ${failed}`)
  if (failed > 0) process.exit(1)
}

main()
