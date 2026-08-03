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
      "AWS Certified",
      "IEEE Published Researcher",
      "NLP & Computer Vision Practitioner",
    ],
    tagline: "Passionate about changing the world with technology.",
    // Bump the ?v= number whenever you replace the photo file so
    // visitors' browsers fetch the new one instead of a cached copy
    photo: "assets/profile.png?v=2",
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
      "Hello world! This is Muhammad Saif Basit, a Computer Science graduate, an AWS Certified AI Practitioner and a data geek. I'm all about the tech world, with a passion for AI/ML, Data Science, Computer Vision and Natural Language Processing.",
      "At heart, I'm a researcher. As a first author of a publication in IEEE, the world's largest technical organization, I've experienced the full research cycle: framing the problem, digging through literature, experimenting rigorously and defending the results. That research-oriented mindset shapes how I work: I don't just apply models, I question them, benchmark them and push into the why behind every result.",
      "I'm the kind of person who can't resist the allure of the latest tech trends - always reading, always experimenting with what's next in AI.",
    ],
    // Quick facts shown as animated stat cards
    stats: [
      { value: "IEEE",  label: "First-Author Publication" },
      { value: "AWS",   label: "Certified AI Practitioner" },
      { value: "10+",   label: "AI / ML Projects" },
      { value: "BSCS",  label: "Computer Science Graduate" },
    ],
  },

  /* ---------- Skills ----------
     Technical skills are grouped into cards. Add / remove a group or
     an item and the layout reflows automatically.
     Icons: brain, robot, code, chart, layers, dashboard, cloud       */
  skills: {
    heading: "Skills",
    technical: [
      {
        group: "Machine Learning & AI",
        icon: "brain",
        items: ["Machine Learning", "Deep Learning", "Computer Vision",
          "Natural Language Processing (NLP)", "Large Language Models (LLMs)",
          "Local LLMs", "Transformers", "Predictive Modeling", "Feature Engineering"],
      },
      {
        group: "Agentic AI & Automation",
        icon: "robot",
        items: ["Agentic Workflows", "AI Agents", "Prompt Engineering", "Ollama",
          "Cron Job Scheduling", "Background Workers", "Workflow Automation"],
      },
      {
        group: "Programming & Databases",
        icon: "code",
        items: ["Python", "SQL", "MySQL", "PostgreSQL", "MongoDB", "JavaScript", "C++", "DAX"],
      },
      {
        group: "Data Science & Analytics",
        icon: "chart",
        items: ["Exploratory Data Analysis (EDA)", "Data Cleaning & Transformation",
          "Statistical Analysis", "ETL Pipelines", "A/B Testing"],
      },
      {
        group: "ML Frameworks & Libraries",
        icon: "layers",
        items: ["TensorFlow", "Keras", "Scikit-learn", "PyTorch", "NumPy", "Pandas",
          "NLTK", "OpenCV", "Matplotlib", "Seaborn"],
      },
      {
        group: "BI & Visualization",
        icon: "dashboard",
        items: ["Power BI", "Tableau", "Looker Studio", "Excel", "KPI Dashboards"],
      },
      {
        group: "APIs, MLOps & Cloud",
        icon: "cloud",
        items: ["Tavily API", "Telegram Bot API", "REST APIs", "FastAPI", "AWS", "Azure",
          "GCP", "Docker", "Git & GitHub", "CI/CD Pipelines", "Model Deployment"],
      },
    ],
    softHeading: "Professional Skills",
    soft: [
      "Adaptability", "Creativity", "Positivity", "Problem Solving",
      "Collaboration", "Team Player", "Goal-Oriented", "Empathy",
    ],
  },

  /* ---------- Projects ----------
     date:  YYYY-MM — newest projects are sorted to the top
            automatically, so just add new ones anywhere in the list
     tags:  small tech chips on the card
     link:  where the card points (GitHub, demo, …)                  */
  projects: {
    heading: "Projects",
    items: [
      {
        title: "This 3D Portfolio",
        date: "2026-07",
        description:
          "The site you're looking at - an interactive single-page portfolio with a custom WebGL neural-particle scene. Fully config-driven.",
        tags: ["WebGL", "JavaScript", "GitHub Pages"],
        link: "https://github.com/msaifbasit/portfolio",
        icon: "cube",
      },
      {
        title: "Chatbot with DialoGPT",
        date: "2023-09",
        description:
          "Conversational AI chatbot built on Microsoft's DialoGPT, served through both Gradio and Flask web interfaces.",
        tags: ["NLP", "Transformers", "Flask", "Gradio"],
        link: "https://github.com/msaifbasit/Chatbot_DialoGPT",
        icon: "chat",
      },
      {
        title: "Chicken Disease Classification",
        date: "2023-09",
        description:
          "End-to-end deep-learning website that classifies chicken diseases from fecal images using convolutional neural networks.",
        tags: ["CNN", "Computer Vision", "Deep Learning"],
        link: "https://github.com/msaifbasit/Chicken-Disease-Classification",
        icon: "vision",
      },
      {
        title: "Potato Disease Classification",
        date: "2023-03",
        description:
          "Deep-learning pipeline that detects early and late blight in potato plants from leaf images to help farmers act fast.",
        tags: ["TensorFlow", "CNN", "Image Classification"],
        link: "https://github.com/msaifbasit/Potato-Disease-Classification-Deep-Learning",
        icon: "leaf",
      },
      {
        title: "Drowsiness Detection",
        date: "2023-01",
        description:
          "Real-time driver-drowsiness detection system using computer vision and deep learning to reduce road accidents.",
        tags: ["OpenCV", "Deep Learning", "Real-Time"],
        link: "https://github.com/msaifbasit/Drowsiness-Detection-Deep-Learning",
        icon: "eye",
      },
      {
        title: "Movies Recommender System",
        date: "2023-01",
        description:
          "Content-based movie recommendation engine that suggests similar titles using NLP feature vectors and cosine similarity.",
        tags: ["Recommender", "NLP", "scikit-learn"],
        link: "https://github.com/msaifbasit/Movies-Recommender-System",
        icon: "film",
      },
    ],
  },

  /* ---------- Publications ----------
     featured: true pins the entry to the top of the list
     icon: journal (peer-reviewed) or article (blog / magazine)      */
  publications: {
    heading: "Publications",
    items: [
      {
        featured: true,
        icon: "journal",
        title:
          "Driver Drowsiness Detection with Region-of-Interest Selection Based Spatio-Temporal Deep Convolutional-LSTM",
        venue:
          "IEEE - 16th International Conference on Open Source Systems and Technologies (ICOSST), Lahore, Pakistan, 2022",
        meta: "DOI: 10.1109/ICOSST57195.2022.10016825",
        description:
          "First-authored IEEE study proposing an automatic region-of-interest selection based stacked ConvLSTM network for real-time, in-vehicle driver drowsiness detection and alerting.",
        tags: ["IEEE", "Deep Learning", "ConvLSTM", "Computer Vision"],
        link: "https://ieeexplore.ieee.org/document/10016825",
        linkLabel: "View Paper",
      },
      {
        icon: "article",
        title: "The Future of Data Analysts: What Can We Expect in 2030?",
        venue: "Medium",
        description:
          "Breaks down what a Data Analyst actually does beyond charts in Excel, then looks ahead to AI, advanced visualization, data ethics and cross-team collaboration, with real examples like Netflix's data-driven strategy.",
        tags: ["Data Analytics", "AI", "Career"],
        link: "https://medium.com/@SaifWritesData/the-future-of-data-analysts-what-can-we-expect-in-2030-8648acf702c6",
        linkLabel: "Read Article",
      },
      {
        icon: "article",
        title: "What is Data? Why is “Data, Data” everywhere?",
        venue: "Medium",
        description:
          "Why “data” became the buzzword of the century - a ride through the world of digital breadcrumbs and the personalized experiences they power.",
        tags: ["Data", "Explainer"],
        link: "https://medium.com/@SaifWritesData/what-is-data-why-is-data-data-everywhere-0690beed2736",
        linkLabel: "Read Article",
      },
    ],
  },

  /* ---------- Certifications ----------
     Listed in the order given here. Add: name, issuer, year (optional)
     and an optional link to the credential.
     featured: true pins the entry to the top of the grid, so it stays
     first no matter how many certifications are added below it.      */
  certifications: {
    heading: "Certifications",
    items: [
      {
        featured: true,
        name: "AWS Certified AI Practitioner",
        issuer: "Amazon Web Services (AWS)",
        year: "2026",
        link: "assets/AWS-Certified-AI-Practitioner.pdf",
      },
      {
        name: "Supervised Machine Learning: Regression and Classification",
        issuer: "DeepLearning.AI",
      },
      {
        name: "Model Context Protocol (MCP) Mastery",
        issuer: "Fractal Analytics",
      },
      {
        name: "Data Science Virtual Experience Programme",
        issuer: "British Airways",
      },
      {
        name: "Cybersecurity and The Internet of Things",
        issuer: "Kennesaw State University",
      },
      {
        name: "Databases and SQL for Data Science with Python",
        issuer: "IBM",
      },
      {
        name: "Responsive Website Basics: Code with HTML, CSS, and JavaScript",
        issuer: "University of London",
      },
    ],
  },

  /* ---------- Contact ---------- */
  contact: {
    heading: "Get In Touch",
    blurb:
      "Whether you have an idea to discuss, a role to fill, or just want to talk AI, my inbox is always open.",
    email: "msaifbasit@gmail.com",
  },

  /* ---------- Social links ----------
     Supported icons: github, linkedin, scholar, medium, twitter,
     facebook, instagram, email. Remove a line to hide it.       */
  socials: [
    { icon: "github",    url: "https://github.com/msaifbasit" },
    { icon: "linkedin",  url: "https://www.linkedin.com/in/muhammad-saif-basit/" },
    { icon: "scholar",   url: "https://scholar.google.com/citations?user=Mh0PcvEAAAAJ&hl=en&authuser=1" },
    { icon: "instagram", url: "https://www.instagram.com/saifmadesimple/" },
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
    // Brightness of the spotlight that follows the mouse on desktop.
    // 0 turns it off, 1 is the default, 1.5+ is dramatic.
    mouseGlow: 1,
  },
};

export default CONFIG;
