/* ============================================================
   ✏️  EDIT THIS FILE TO CUSTOMIZE YOUR ENTIRE PORTFOLIO
   ------------------------------------------------------------
   Every piece of text, link, skill and project on the website
   lives here. Change a value, save, push — done. No other file
   needs to be touched.
   ============================================================ */

const CONFIG = {

  /* ---------- Identity ---------- */
  identity: {
    firstName: "Muhammad",
    middleName: "Saif",
    lastName: "Basit",
    shortName: "Saif Basit",          // used in navbar / footer
    location: "Jeddah, Saudi Arabia",
    // Roles cycled by the typing animation in the hero section
    roles: [
      "AI Engineer",
      "Data Scientist",
      "Machine Learning Engineer",
      "NLP & Computer Vision Enthusiast",
      "IEEE Published Researcher",
    ],
    tagline: "Passionate about changing the world with technology.",
    photo: "assets/profile.png",
  },

  /* ---------- Resume ----------
     Live link — update the Google Doc and the site always serves
     the latest version. Set to "" to hide the resume buttons.   */
  resumeUrl:
    "https://docs.google.com/document/d/1E4XQMZPFP5xhXg-Ajty2ks-39G84mv4m/edit?usp=sharing&ouid=103313520272293022509&rtpof=true&sd=true",

  /* ---------- About ---------- */
  about: {
    heading: "About Me",
    // Each string renders as its own paragraph
    paragraphs: [
      "Hello world! This is Muhammad Saif Basit, a Computer Science graduate and a data geek. I'm all about the tech world, with a passion for AI/ML, Data Science, Computer Vision and Natural Language Processing.",
      "Being a first author of a publication in IEEE, the world's largest technical organization, showcases my commitment to advancing the field of AI. I'm the kind of person who can't resist the allure of the latest tech trends.",
    ],
    // Quick facts shown as animated stat cards
    stats: [
      { value: "IEEE",  label: "First-Author Publication" },
      { value: "6+",    label: "AI / ML Projects" },
      { value: "3",     label: "Cloud Platforms" },
      { value: "BSCS",  label: "Computer Science Graduate" },
    ],
  },

  /* ---------- Skills ---------- */
  skills: {
    heading: "Skills",
    // Animated proficiency bars (value = 0–100)
    hard: [
      { name: "Python",                      value: 90 },
      { name: "AI / Machine Learning",       value: 90 },
      { name: "Data Science",                value: 90 },
      { name: "Natural Language Processing", value: 85 },
      { name: "Computer Vision",             value: 85 },
      { name: "Data Structures",             value: 85 },
      { name: "AWS / Azure / GCP",           value: 80 },
      { name: "SQL",                         value: 75 },
    ],
    // Tech-stack chips grouped by category
    stack: [
      { group: "Languages",     items: ["Python", "C++", "SQL", "JavaScript", "HTML5", "CSS3"] },
      { group: "AI / ML",       items: ["TensorFlow", "PyTorch", "scikit-learn", "Pandas", "NumPy", "OpenCV"] },
      { group: "Backend",       items: ["Django", "Flask", "FastAPI", "Docker"] },
      { group: "Databases",     items: ["MySQL", "PostgreSQL", "SQLite"] },
      { group: "Cloud & Tools", items: ["AWS", "Azure", "Google Cloud", "Git", "Gradio"] },
    ],
    soft: [
      "Adaptability", "Creativity", "Positivity", "Problem Solving",
      "Collaboration", "Team Player", "Goal-Oriented", "Empathy",
    ],
  },

  /* ---------- Projects ----------
     tags: small tech chips on the card
     link: where the card's button points (GitHub, demo, …)      */
  projects: {
    heading: "Projects",
    items: [
      {
        title: "Chatbot with DialoGPT",
        description:
          "Conversational AI chatbot built on Microsoft's DialoGPT, served through both Gradio and Flask web interfaces.",
        tags: ["NLP", "Transformers", "Flask", "Gradio"],
        link: "https://github.com/msaifbasit/Chatbot_DialoGPT",
        icon: "chat",
      },
      {
        title: "Chicken Disease Classification",
        description:
          "End-to-end deep-learning website that classifies chicken diseases from fecal images using convolutional neural networks.",
        tags: ["CNN", "Computer Vision", "Deep Learning"],
        link: "https://github.com/msaifbasit/Chicken-Disease-Classification",
        icon: "vision",
      },
      {
        title: "Potato Disease Classification",
        description:
          "Deep-learning pipeline that detects early and late blight in potato plants from leaf images to help farmers act fast.",
        tags: ["TensorFlow", "CNN", "Image Classification"],
        link: "https://github.com/msaifbasit/Potato-Disease-Classification-Deep-Learning",
        icon: "leaf",
      },
      {
        title: "Drowsiness Detection",
        description:
          "Real-time driver-drowsiness detection system using computer vision and deep learning to reduce road accidents.",
        tags: ["OpenCV", "Deep Learning", "Real-Time"],
        link: "https://github.com/msaifbasit/Drowsiness-Detection-Deep-Learning",
        icon: "eye",
      },
      {
        title: "Movies Recommender System",
        description:
          "Content-based movie recommendation engine that suggests similar titles using NLP feature vectors and cosine similarity.",
        tags: ["Recommender", "NLP", "scikit-learn"],
        link: "https://github.com/msaifbasit/Movies-Recommender-System",
        icon: "film",
      },
      {
        title: "This 3D Portfolio",
        description:
          "The site you're looking at — an interactive single-page portfolio with a Three.js neural-particle scene. Fully config-driven.",
        tags: ["Three.js", "JavaScript", "GitHub Pages"],
        link: "https://github.com/msaifbasit/portfolio",
        icon: "cube",
      },
    ],
  },

  /* ---------- Contact ---------- */
  contact: {
    heading: "Get In Touch",
    blurb:
      "Whether you have an idea to discuss, a role to fill, or just want to talk AI — my inbox is always open.",
    email: "saifbasit64@gmail.com",
  },

  /* ---------- Social links ----------
     Supported icons: github, linkedin, twitter, facebook,
     instagram, email. Remove a line to hide it.                 */
  socials: [
    { icon: "github",    url: "https://github.com/msaifbasit" },
    { icon: "linkedin",  url: "https://www.linkedin.com/in/muhammad-saif-basit/" },
    { icon: "twitter",   url: "https://www.twitter.com/cake_rusk/" },
    { icon: "facebook",  url: "https://www.facebook.com/muhammad.s.basit" },
    { icon: "instagram", url: "https://www.instagram.com/saifoholic/" },
  ],

  /* ---------- Theme ----------
     Tweak the site's accent colours (any CSS colour works).     */
  theme: {
    accent:  "#22d3ee",   // cyan  — primary accent
    accent2: "#a78bfa",   // violet — secondary accent
  },

  /* ---------- 3D background ---------- */
  scene: {
    enabled: true,        // set false to disable the 3D canvas entirely
    particleCount: 130,   // desktop particle count (mobile auto-reduces)
    linkDistance: 2.6,    // max distance at which particles connect
  },
};

export default CONFIG;
