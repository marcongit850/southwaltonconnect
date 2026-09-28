// The only site footer. Pages load this script where the footer should appear.
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

  var pages = [
    { href: root, label: "Home" },
    { href: root + "environment/", label: "Environment" },
    { href: root + "public-feedback/", label: "Community Survey" },
    { href: root + "faq/", label: "FAQ" },
    { href: root + "blog/", label: "Blog" },
    { href: root + "documents/", label: "Documents" }
  ];

  var links = pages.map(function (page) {
    var attrs = page.current ? ' aria-current="page"' : "";
    return '<a href="' + page.href + '"' + attrs + ">" + page.label + "</a>";
  }).join("\n      ");

  script.insertAdjacentHTML("beforebegin", [
    '<footer class="site-footer">',
    '  <div class="wrap footer-grid">',
    "    <div>",
    "      <p class=\"footer-name\">South Walton Connect</p>",
    "      <p>The South Walton Connector is a proposed additional public connection between Scenic Highway 30A and US 98. This site collects the public record and community questions about that proposal.</p>",
    "      <p class=\"legal\">An independent community information site. Not an official Walton County, Florida website, and not affiliated with the project engineers.</p>",
    "    </div>",
    '    <nav class="footer-nav" aria-label="Footer">',
    "      " + links,
    "    </nav>",
    "  </div>",
    "</footer>"
  ].join("\n"));
})();
