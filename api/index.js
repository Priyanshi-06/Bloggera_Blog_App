import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Adjusted for Vercel folder structure
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));
app.use(express.static(path.join(__dirname, "../public")));
app.use(bodyParser.urlencoded({ extended: true }));

const sessionOptions = {
  secret: "super-secret-key-for-blog",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
};

app.use(session(sessionOptions));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  if (req.query.redirectTo) {
    req.session.redirectTo = decodeURIComponent(req.query.redirectTo);
  }
  res.locals.redirectTo = req.session.redirectTo || null;
  next();
});

function requireActiveSession(req, res, next) {
  if (req.session.user) {
    res.locals.user = req.session.user;
    next();
  } else {
    const originalUrl = req.session.redirectTo || req.originalUrl || req.url;
    res.redirect(`/sign_in?redirectTo=${encodeURIComponent(originalUrl)}&message=Please sign in to continue.`);
  }
}

const users = [];
const blogEntries = [];

const initialBlogs = [
  {
    id: "init-1",
    title: "The Psychology of Procrastination",
    description: "Ever wondered why we delay even the simplest tasks? Dive into the science behind procrastination and learn techniques to beat it for good.",
    createdAt: new Date("2025-05-20T15:30:00")
  },
  {
    id: "init-2",
    title: "A Journey Through the Multiverse",
    description: "Explore the fascinating concept of parallel universes in physics and how they might just be more real than science fiction.",
    createdAt: new Date("2025-05-21T10:00:00")
  },
  {
    id: "init-3",
    title: "How I Made My First $1000 with a Side Hustle",
    description: "A beginner-friendly breakdown of how I turned a weekend project into a steady online income.",
    createdAt: new Date("2025-05-22T18:45:00")
  },
  {
    id: "init-4",
    title: "Digital Privacy in 2025: Are We Safe Yet?",
    description: "With AI everywhere, what does privacy really mean now? A deep dive into how our data is used and how to protect it.",
    createdAt: new Date("2025-05-23T14:20:00")
  },
  {
    id: "init-5",
    title: "Meditation for Coders: A Daily 10-Minute Routine",
    description: "Burnout is real. Here's a daily meditation routine tailored specifically for developers and creatives.",
    createdAt: new Date("2025-05-24T08:10:00")
  },
  {
    id: "init-6",
    title: "CRISPR and the Future of Human Evolution",
    description: "Discover how gene editing technology is reshaping medicine and what it could mean for future generations.",
    createdAt: new Date("2025-05-25T13:55:00")
  },
  {
    id: "init-7",
    title: "How Drawing Every Day Changed My Brain",
    description: "After 30 days of sketching, I noticed more than just better art. Here's how daily drawing improved my memory and focus.",
    createdAt: new Date("2025-05-26T11:40:00")
  }
];

// --- Routes ---

app.get("/", (req, res) => {
  const blogs = [...initialBlogs, ...blogEntries].sort((a, b) => b.createdAt - a.createdAt);
  res.render("home", { blogs });
});

app.get("/register", (req, res) => {
  if (req.session.user) {
    const redirectTo = req.session.redirectTo || '/';
    delete req.session.redirectTo;
    return res.redirect(redirectTo);
  }
  res.render("register", { message: req.query.message || null, username: req.query.username || "", email: req.query.email || "" });
});

app.post("/register", (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.render("register", { message: "All fields are required.", username, email });
  }
  const existingUser = users.find(user => user.email === email);
  if (existingUser) {
    let signInUrl = `/sign_in?message=${encodeURIComponent("Email already registered. Please sign in.")}&email=${encodeURIComponent(email)}`;
    if(req.session.redirectTo) {
        signInUrl += `&redirectTo=${encodeURIComponent(req.session.redirectTo)}`;
    }
    return res.redirect(signInUrl);
  }
  const newUser = { id: Date.now().toString(), username, email, password };
  users.push(newUser);
  req.session.user = newUser;
  const redirectTo = req.session.redirectTo || "/add_blog";
  delete req.session.redirectTo;
  res.redirect(redirectTo);
});

app.get("/sign_in", (req, res) => {
  if (req.session.user) {
    const redirectTo = req.session.redirectTo || '/';
    delete req.session.redirectTo;
    return res.redirect(redirectTo);
  }
  res.render("sign_in", { message: req.query.message || null, email: req.query.email || "" });
});

app.post("/sign_in", (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    return res.render("sign_in", { message: "Invalid email or password.", email });
  }
  req.session.user = user;
  const redirectTo = req.session.redirectTo || "/add_blog";
  delete req.session.redirectTo;
  res.redirect(redirectTo);
});

app.get("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) console.error("Logout error:", err);
    res.redirect("/?message=You have been signed out.");
  });
});

app.get("/add_blog", requireActiveSession, (req, res) => {
  res.render("add_blog", { message: null, title: "", content: "" });
});

app.post("/add_blog", requireActiveSession, (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.render("add_blog", {
      message: "Title and content are required.",
      title: title || "",
      content: content || ""
    });
  }
  const newEntry = {
    id: Date.now().toString(),
    authorId: req.session.user.id,
    authorUsername: req.session.user.username,
    email: req.session.user.email,
    title,
    content,
    createdAt: new Date()
  };
  blogEntries.push(newEntry);
  res.redirect("/");
});

app.get("/view", (req, res) => {
  const combinedBlogs = [...initialBlogs, ...blogEntries].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  res.render("view_all", { blogs: combinedBlogs });
});

app.get("/delete", requireActiveSession, (req, res) => {
  const messageToShow = req.session.deleteMessage || null;
  delete req.session.deleteMessage;
  res.render("delete.ejs", { message: messageToShow });
});

app.post("/delete", requireActiveSession, (req, res) => {
  const titleToDelete = req.body.blogTitle?.trim().toLowerCase();
  if (!titleToDelete) {
    req.session.deleteMessage = "Please provide a blog title to delete.";
    return res.redirect("/delete");
  }

  const existsInInitial = initialBlogs.some(entry => entry.title.trim().toLowerCase() === titleToDelete);
  if (existsInInitial) {
    req.session.deleteMessage = "This blog is part of the default collection and cannot be deleted.";
    return res.redirect("/delete");
  }

  const index = blogEntries.findIndex(entry =>
    entry.title.trim().toLowerCase() === titleToDelete && entry.authorId === req.session.user.id
  );

  if (index !== -1) {
    blogEntries.splice(index, 1);
    req.session.deleteMessage = "Blog deleted successfully!";
  } else {
    const existsButNotOwned = blogEntries.some(entry => entry.title.trim().toLowerCase() === titleToDelete);
    req.session.deleteMessage = existsButNotOwned
      ? "You are not authorized to delete this blog."
      : "Blog not found!";
  }

  res.redirect("/delete");
});

app.get("/edit", requireActiveSession, (req, res) => {
  res.render("edit.ejs", {
    message: req.session.editMessage || null,
    blogToEdit: null
  });
  delete req.session.editMessage;
});

app.post("/edit", requireActiveSession, (req, res) => {
  const originalTitle = req.body.EditedBlogTitle?.trim().toLowerCase();
  const newDesc = req.body.EditedBlogDesc?.trim();
  if (!originalTitle || !newDesc) {
    req.session.editMessage = "Both fields are required.";
    return res.redirect("/edit");
  }

  const blog = blogEntries.find(b => b.title.trim().toLowerCase() === originalTitle);
  if (!blog) {
    req.session.editMessage = "Blog not found! Create it first.";
    return res.redirect("/edit");
  }

  if (blog.authorId !== req.session.user?.id) {
    req.session.editMessage = "You are not authorized to edit this blog.";
    return res.redirect("/edit");
  }

  blog.description = newDesc;
  blog.updatedAt = new Date();
  req.session.editMessage = "Blog description updated successfully!";
  res.redirect("/view");
});

app.post("/submit", requireActiveSession, (req, res) => {
  const { blogTitle, blogDesc } = req.body;
  if (!blogTitle || !blogDesc) {
    return res.status(400).send("Title and description are required.");
  }
  blogEntries.push({
    id: Date.now().toString(),
    title: blogTitle,
    description: blogDesc,
    authorId: req.session.user.id,
    authorUsername: req.session.user.username,
    createdAt: new Date()
  });
  res.redirect("/view");
});

// ⛔ Don't use app.listen() on Vercel

// ✅ Required: Vercel export handler
const server = createServer(app);
export default function handler(req, res) {
  server.emit("request", req, res);
}
