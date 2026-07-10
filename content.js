/* ============================================================================
   PRIME COLLECTIONS — WEBSITE WORDS & DETAILS
   ============================================================================

   This is the ONLY file you need to change the words and details on the site.

   HOW TO EDIT — please read once:
     •  Change ONLY the text between the "quotation marks".
     •  Do NOT change the words before the colon (e.g.  phone:  ) — those are
        labels the website needs.
     •  Keep every "quote", every , comma and every { } bracket exactly as it is.
     •  Words in {curly brackets} such as {phone} or {email} fill themselves in
        automatically from YOUR DETAILS below — you don't need to touch them.
     •  When you're done: save the file. The website updates once it's uploaded.

   IF SOMETHING LOOKS WRONG after an edit, it is almost always a missing "
   quotation mark or , comma. Undo your last change and it will be fine — the
   site keeps working on its old wording until the file is correct again.
   ============================================================================ */

window.CONTENT = {

  /* ----------------------------------------------------------------------
     YOUR DETAILS   —  change these once; they update across the whole site
     ---------------------------------------------------------------------- */
  company:     "Prime Collections LTD",
  phone:       "xxxx.xxxx.xxxx",        // e.g. "0131 555 0785"
  email:       "xxxx.xxxx.xxxx",        // e.g. "info@primecollections.co.uk"
  established: "1986",                  // the year shown as "Est. …"
  regNumber:   "[UPDATE]",              // Companies House registration number
  regAddress:  "[UPDATE ADDRESS]",      // registered office address
  year:        "2026",                  // year in the copyright line

  /* ----------------------------------------------------------------------
     TOP MENU
     ---------------------------------------------------------------------- */
  nav: {
    home:        "Home",
    services:    "Services",
    latePayment: "Late Payment",
    contact:     "Contact",
    cta:         "Start recovery"
  },

  /* ----------------------------------------------------------------------
     PAGE HEADING (the big words at the top)
     ---------------------------------------------------------------------- */
  hero: {
    eyebrow:       "Commercial Debt Recovery · Edinburgh & Glasgow",
    headline_html: "Get paid what <em>you're owed.</em>",   // <em> = the gold words
    sub:           "Commercial debt management and credit control that turns overdue invoices back into cashflow. Same-day action, no contract to sign, market-leading fees.",
    cta:           "Start your recovery",
    callLabel:     "Call today"
  },

  /* ----------------------------------------------------------------------
     "HOW LATE IS THE INVOICE?" strip
     ---------------------------------------------------------------------- */
  aged: {
    head1:     "How late is the invoice?",
    head2:     "Red = we step in ↓",
    c1k: "Current",  c1v: "Not due",
    c2k: "30 days",  c2v: "Slipping",
    c3k: "60 days",  c3v: "Overdue",
    c4k: "90+ days", c4v: "At risk",
    note_html: "Once an invoice is <b>90+ days late</b>, the odds of collecting it yourself fall sharply. That's where we step in.",
    paid:      "→ PAID"
  },

  /* ----------------------------------------------------------------------
     THE FOUR SMALL BOXES under the heading
     ---------------------------------------------------------------------- */
  trust: {
    c1k: "Est. {established}", c1d: "Decades of recovery experience",
    c2k: "Same day",           c2d: "Cases actioned immediately",
    c3k: "No contract",        c3d: "Nothing to sign, ever",
    c4k: "£ millions",         c4d: "Recovered for UK businesses"
  },

  /* ----------------------------------------------------------------------
     "IS YOUR BUSINESS OWED MONEY?" section
     ---------------------------------------------------------------------- */
  services: {
    eyebrow:   "Is your business owed money?",
    heading:   "If you're struggling to recover cash, we can help.",
    sub:       "A full commercial debt management service, carefully managed from first contact to litigation — so you can get back to running your business.",
    listLabel: "What's included",
    item1: "Full commercial debt management service",
    item2: "No contract to sign",
    item3: "Cases actioned same day",
    item4: "Dedicated client relationship manager",
    item5: "Market-leading fees",
    item6: "Proactive service — telephony, email and letter",
    item7: "Seamless process to litigation",
    item8: "Late payment collections",
    estK: "Est.",
    estV: "{established}",
    guaranteeTitle: "Best of Both Worlds Guarantee",
    guaranteeText:  "A seamless, low-cost process managed from pre-sue to litigation with our partner firms — bringing true transparency and cost management if and when litigation is required."
  },

  /* ----------------------------------------------------------------------
     "WHY WORK WITH US" section
     ---------------------------------------------------------------------- */
  why: {
    eyebrow: "Why work with us",
    heading: "Recovery professionals you can rely on",
    i1t: "Decades of experience",
    i1p: "A specialist business-to-business collections company. We use that experience to exceed expectations and offer a seamless service from pre-sue right through to litigation.",
    i2t: "Management expertise",
    i2p: "Dedicated arrears management, tracing, recovery and litigation across the UK, backed by strong relationships with tracing agents, insolvency practitioners and sheriff officers.",
    i3t: "Millions of pounds recovered",
    i3p: "No debt is too small. Our costs are often covered by late payment collection. The aim is simple: outstanding results, and more cash back in your business.",
    i4t: "Seamless partnerships",
    i4p: "Low-cost litigation services through our partner firms give you a smooth path from collection to court on the occasions it's needed.",
    i5t: "Expert staff",
    i5p: "We employ and train people who understand that different businesses need different approaches. Our diverse client base all demand results and a positive experience."
  },

  /* ----------------------------------------------------------------------
     "ABOUT US" section
     ---------------------------------------------------------------------- */
  about: {
    eyebrow:     "About us",
    heading:     "Dependable recovery, fair rates",
    text:        "{company} provides dependable debt collection services to private and commercial clients across the UK. We're proud that our rates are among the most affordable in the industry. Call our team on {phone} to discuss our competitive fees.",
    cta:         "Talk to us",
    stHead:      "Statement of Account",
    stRecovered: "Recovered · Paid"
  },

  /* ----------------------------------------------------------------------
     "THE PRIME DIFFERENCE" cards
     ---------------------------------------------------------------------- */
  benefits: {
    eyebrow: "The Prime difference",
    heading: "Built to put money back in your business",
    b1label: "Fees",
    b1title: "Cost effective",
    b1text:  "Low commission rates, charged as a share of what we recover — subject to debt value.",
    b1big:   "Low %",
    b1cap:   "of sums recovered",
    b2label: "Service",
    b2title: "Focused",
    b2text:  "We handle everything start to finish, so you can focus on running your business.",
    b2s1: "Instruct",
    b2s2: "Recover",
    b2s3: "Close",
    b3label: "Results",
    b3title: "Cash flow",
    b3text:  "With our strong retrieval rate, you pocket the money you've already earned.",
    b3owed: "Owed",
    b3paid: "Paid"
  },

  /* ----------------------------------------------------------------------
     "LATE PAYMENT LEGISLATION" section  (the amounts are here)
     ---------------------------------------------------------------------- */
  legislation: {
    eyebrow: "Late Payment Legislation",
    heading: "You're owed more than the invoice",
    text:    "Under the Late Payment of Commercial Debts (Interest) Act 1998, when a business pays late you can claim statutory interest, fixed compensation and reasonable recovery costs — on top of the debt itself. Often that covers the cost of recovery entirely.",
    c1big:   "8% + base",
    c1title: "Statutory interest",
    c1text:  "8% a year plus the Bank of England base rate, charged from the day payment fell due.",
    c2big:   "£40–100",
    c2title: "Fixed compensation",
    c2text:  "A set sum for every unpaid invoice — £40, £70 or £100 depending on the size of the debt.",
    c3big:   "+ costs",
    c3title: "Recovery costs",
    c3text:  "You can also reclaim the reasonable costs of recovering what you're owed. We handle the calculation and the claim."
  },

  /* ----------------------------------------------------------------------
     BOTTOM OF PAGE (footer, enquiry form, small print)
     ---------------------------------------------------------------------- */
  footer: {
    home:        "Home",
    services:    "Services",
    latePayment: "Late Payment Legislation",
    contact:     "Contact",
    blurb_html:  "Contact {company} at <a href=\"mailto:{email}\">{email}</a> for independent debt collection from recovery professionals. Or call the team on {phone} to discuss your requirements.",
    copyright_html: "{company} is a company incorporated in Scotland (Registered No: {regNumber}) whose registered office is {regAddress}. © {year} {company}. All rights reserved. <a href=\"#top\">Privacy Policy</a>"
  },

  /* ----------------------------------------------------------------------
     THE ENQUIRY FORM (the box people type into, at the bottom)
     ---------------------------------------------------------------------- */
  form: {
    title:    "Send an enquiry",
    badge:    "Same-day reply",
    ph_name:  "Your full name *",
    ph_org:   "Your organisation",
    ph_email: "Your email *",
    ph_phone: "Your telephone",
    ph_query: "How can we help you?",
    submit:   "Submit request"
  },

  /* ----------------------------------------------------------------------
     BROWSER TAB TITLE & SEARCH DESCRIPTION
     ---------------------------------------------------------------------- */
  meta: {
    title:       "{company} — Commercial Debt Recovery, Edinburgh & Glasgow",
    description: "Get paid what you're owed. Commercial debt recovery and credit control across the UK — same-day action, no contract, market-leading fees."
  }
};
