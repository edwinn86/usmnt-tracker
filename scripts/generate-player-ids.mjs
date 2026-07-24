const squadUrl = "https://www.fotmob.com/teams/6713/squad/usa";

const categories = {
  usmntPlayerIds: [
    { lookup: "Christian Pulisic", label: "Christian Pulisic" },
    { lookup: "Weston McKennie", label: "Weston McKennie" },
    { lookup: "Tyler Adams", label: "Tyler Adams" },
    { lookup: "Antonee Robinson", label: "Antonee Robinson" },
    { lookup: "Matt Turner", label: "Matt Turner" },
    { lookup: "Sergino Dest", label: "Sergiño Dest" },
    { lookup: "Folarin Balogun", label: "Folarin Balogun" },
    { lookup: "Giovanni Reyna", label: "Gio Reyna" },
    { lookup: "Chris Richards", label: "Chris Richards" },
    { lookup: "Timothy Weah", label: "Tim Weah" },
    { lookup: "Joseph Scally", label: "Joe Scally" },
    { lookup: "Brenden Aaronson", label: "Brenden Aaronson" },
    { lookup: "Malik Tillman", label: "Malik Tillman" },
    { lookup: "Miles Robinson", label: "Miles Robinson" },
    { lookup: "Ricardo Pepi", label: "Ricardo Pepi" },
    { lookup: "Alex Freeman", label: "Alex Freeman" },
    { lookup: "Mark McKenzie", label: "Mark McKenzie" },
    { lookup: "Auston Trusty", label: "Auston Trusty" },
    { lookup: "Tim Ream", label: "Tim Ream" },
  ],
  usmntProspectIds: [
    { lookup: "Gabriel Slonina", label: "Gaga Slonina" },
    { lookup: "Zavier Gozo", label: "Zavier Gozo" },
    { lookup: "Cavan Sullivan", label: "Cavan Sullivan" },
    { lookup: "Quinn Sullivan", label: "Quinn Sullivan" },
    { lookup: "Nimfasha Berchimas", label: "Nimfasha Berchimas" },
    { lookup: "Diego Kochen", label: "Diego Kochen" },
    { lookup: "Cruz Medina", label: "Cruz Medina" },
    { lookup: "Keyrol Figueroa", label: "Keyrol Figueroa" },
    { lookup: "Cole Campbell", label: "Cole Campbell" },
    { lookup: "Benjamin Cremaschi", label: "Benjamin Cremaschi" },
    { lookup: "Esmir Bajraktarevic", label: "Esmir Bajraktarevic" },
    { lookup: "Judah Adams", label: "Judah Adams" },
    { lookup: "Neil Pierre", label: "Neil Pierre" },
    { lookup: "Josh wydner", label: "Josh wydner" },
    { lookup: "Jalen Neal", label: "Jalen Neal" },
    { lookup: "Caden Clark", label: "Caden Clark" },
    { lookup: "Ethan Kohler", label: "Ethan Kohler" },
    { lookup: "Adri Mehmeti", label: "Adri Mehmeti" },
  ],
  usmntCuspIds: [
    { lookup: "Sebastian Berhalter", label: "Sebastian Berhalter" },
    { lookup: "Yunus Musah", label: "Yunus Musah" },
    { lookup: "Paxten Aaronson", label: "Paxten Aaronson" },
    { lookup: "Gianluca Busio", label: "Gianluca Busio" },
    { lookup: "Brian Gutierrez", label: "Brian Gutiérrez" },
    { lookup: "Jack McGlynn", label: "Jack McGlynn" },
    { lookup: "Patrick Schulte", label: "Patrick Schulte" },
    { lookup: "Duncan McGuire", label: "Duncan McGuire" },
    { lookup: "Caleb Wiley", label: "Caleb Wiley" },
    { lookup: "Max Arfsten", label: "Max Arfsten" },
    { lookup: "Diego Luna", label: "Diego Luna" },
    { lookup: "Tanner Tessmann", label: "Tanner Tessmann" },
    { lookup: "Jackson Regan", label: "Jackson Regan" },
    { lookup: "Christian Roldan", label: "Christian Roldan" },
    { lookup: "Haji Wright", label: "Haji Wright" },
  ],
  dualNatIds: [
    { lookup: "Noahkai Banks", label: "Noahkai Banks" },
    { lookup: "Luca Koleosho", label: "Luca Koleosho" },
    { lookup: "Luka Romero", label: "Luka Romero" },
    { lookup: "Daniel Bameyi", label: "Daniel Bameyi" },
    { lookup: "Richie Ledezma", label: "Richie Ledezma" },
    { lookup: "Noel Buck", label: "Noel Buck" },
    { lookup: "Fidel Barajas", label: "Fidel Barajas" },
    { lookup: "Niko Tsakiris", label: "Niko Tsakiris" },
  ],
};

const normalize = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const fetchHtml = async (url) => {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  return await res.text();
};

const extractPlayerLinks = (html) => [...new Set([...html.matchAll(/href="([^"]*\/players\/[^"]+)"/g)].map((m) => m[1]))];
const extractIdFromUrl = (url) => (url.match(/\/players\/(\d+)\//) ? Number(url.match(/\/players\/(\d+)\//)[1]) : null);

const main = async () => {
  const html = await fetchHtml(squadUrl);
  const links = extractPlayerLinks(html);
  const candidates = links.map((href) => {
    const slug = href.split("/players/")[1]?.split("/")[1] || "";
    return { href, id: extractIdFromUrl(href), norm: normalize(slug) };
  });

  const matchName = (name) => {
    const q = normalize(name);
    return candidates.find((c) => c.norm === q) || candidates.find((c) => c.norm.includes(q) || q.includes(c.norm)) || null;
  };

  for (const [key, arr] of Object.entries(categories)) {
    console.log(`export const ${key} = [`);
    for (const player of arr) {
      const m = matchName(player.lookup);
      console.log(m?.id ? `  ${m.id}, // ${player.label}` : `  null, // ${player.label}`);
    }
    console.log(`];\n`);
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});