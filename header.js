// The only site header. Pages load this script where the header should appear.
// Relative links follow the script src: each "../" is one directory above the site root.
(function () {
  var script = document.currentScript;
  if (!script) return;

  var src = script.getAttribute("src") || "";
  var depth = 0;
  while (src.indexOf("../") === 0) {
    depth += 1;
    src = src.slice(3);
  }
  var root = depth === 0 ? "./" : "../".repeat(depth);

  var path = location.pathname || "/";
  if (path.slice(-11) === "/index.html") path = path.slice(0, -10);
  else if (path.slice(-5) === ".html") path = path.slice(0, path.lastIndexOf("/") + 1);
  if (path.slice(-1) !== "/") path += "/";

  var pages = [
    { href: root, label: "Home", current: path === "/" },
    { href: root + "environment/", label: "Environment", current: path.indexOf("/environment/") !== -1 },
    { href: root + "public-feedback/", label: "Community Survey", current: path.indexOf("/public-feedback/") !== -1 },
    { href: root + "faq/", label: "FAQ", current: path.indexOf("/faq/") !== -1 },
    { href: root + "blog/", label: "Blog", current: path.indexOf("/blog/") !== -1 },
    { href: root + "documents/", label: "Documents", current: path.indexOf("/documents/") !== -1 }
  ];

  var links = pages.map(function (page) {
    var attrs = page.current ? ' aria-current="page"' : "";
    return '<a href="' + page.href + '"' + attrs + ">" + page.label + "</a>";
  }).join("\n        ");

  script.insertAdjacentHTML("beforebegin", [
    '<a class="skip-link" href="#content">Skip to content</a>',
    '<header class="site-header">',
    '  <div class="wrap header-inner">',
    '    <a class="brand" href="' + root + '">',
    '      <img class="brand-logo" src="' + root + 'images/logo.png" alt="South Walton Connector" width="900" height="462">',
    '    </a>',
    '    <details class="nav-disclosure">',
    '      <summary class="menu-toggle">Menu</summary>',
    '      <nav class="nav" id="site-nav" aria-label="Primary">',
    "        " + links,
    "      </nav>",
    "    </details>",
    "  </div>",
    "</header>"
  ].join("\n"));
})();
