export default defineAppConfig({
  site: {
    name: "PLB Creator",
    title: "PLB Creator",
    description:
      "AI creator agent for content research, prompt generation, SEO, captions, hooks, and GitHub publishing.",
    tagline: "Eve × Nuxt",
    author: "dassud002-web",
    repo: "https://github.com/dassud002-web/plb-agent",
    deployUrl:
      "https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdassud002-web%2Fplb-agent&env=BETTER_AUTH_SECRET,BETTER_AUTH_URL,INTERNAL_API_SECRET",
    ogImage: "/og.png",
    twitter: "@dassud002-web",
  },
  ui: {
    colors: {
      primary: "neutral",
      neutral: "neutral",
    },
    button: {
      slots: {
        base: "active:translate-y-px transition-transform duration-200",
      },
      defaultVariants: {
        size: "sm",
      },
    },
  },
});
