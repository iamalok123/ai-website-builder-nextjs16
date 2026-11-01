import { describe, it, expect } from "vitest";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function detectPromptStack(messages: Message[]): "python" | "react-node" {
  const lastUserMessage =
    [...messages].reverse().find((m) => m.role === "user")?.content.toLowerCase() || "";
  const pythonKeywords = [
    "python",
    "flask",
    "django",
    "fastapi",
    "uvicorn",
    "pandas",
    "numpy",
    "streamlit",
  ];
  const isPython = pythonKeywords.some((keyword) => lastUserMessage.includes(keyword));
  return isPython ? "python" : "react-node";
}

describe("AI Prompt Router & Stack Classification", () => {
  it("should default to react-node for standard web apps", () => {
    const messages: Message[] = [
      { role: "user", content: "Build a modern kanban board with drag and drop" },
    ];
    expect(detectPromptStack(messages)).toBe("react-node");
  });

  it("should route to python stack when 'fastapi' keyword is present", () => {
    const messages: Message[] = [
      { role: "user", content: "Create a REST API for book management using FastAPI" },
    ];
    expect(detectPromptStack(messages)).toBe("python");
  });

  it("should route to python stack when 'flask' or 'django' is specified", () => {
    expect(detectPromptStack([{ role: "user", content: "Flask microservice for sentiment analysis" }])).toBe("python");
    expect(detectPromptStack([{ role: "user", content: "Build a Django e-commerce backend" }])).toBe("python");
  });

  it("should route to python stack for data science keywords like pandas and streamlit", () => {
    expect(detectPromptStack([{ role: "user", content: "Visualize stock prices with Streamlit and Pandas" }])).toBe("python");
  });

  it("should inspect the most recent user message in a conversation thread", () => {
    const messages: Message[] = [
      { role: "user", content: "Build a Python backend" },
      { role: "assistant", content: "Created main.py" },
      { role: "user", content: "Now build a React frontend with Tailwind" },
    ];
    expect(detectPromptStack(messages)).toBe("react-node");
  });
});
