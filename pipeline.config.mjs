// Studio-wide defaults for every project. A project's pipeline.yaml can tighten them, never loosen
// them without a written reason in its `waivers:` list (the review report prints every waiver).
export default {
  // Widths every page is tested at: small phone → large desktop.
  viewports: [320, 375, 390, 414, 768, 1024, 1280, 1440, 1920],
  // The three the review report shows side by side.
  reviewViewports: [390, 768, 1440],

  a11y: {
    // axe-core rule tags. WCAG 2.2 AA plus axe best practices.
    tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
    failOn: ['minor', 'moderate', 'serious', 'critical'],
  },

  responsive: {
    minFontPx: 13, // smallest legible text
    minTargetPx: 24, // WCAG 2.2 SC 2.5.8 floor
    comfortableTargetPx: 44, // below this is a warning on touch widths
    maxHeadingLines: 2, // Taste house rule
  },

  lighthouse: {
    // Category scores out of 1, per form factor.
    mobile: { performance: 0.9, accessibility: 1, 'best-practices': 0.95, seo: 0.95 },
    desktop: { performance: 0.95, accessibility: 1, 'best-practices': 0.95, seo: 0.95 },
    // Core Web Vitals budgets (lab, mobile).
    metrics: { 'largest-contentful-paint': 2500, 'cumulative-layout-shift': 0.1, 'total-blocking-time': 200 },
    // Transfer weight of the first load, in KB.
    pageWeightKb: 1000,
  },

  seo: {
    title: [20, 60],
    description: [70, 160],
  },

  browsers: ['chromium', 'firefox', 'webkit'],
};
