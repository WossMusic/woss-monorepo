import React, { useState } from "react";
import "assets/css/ContributorsModal.css";
import { FormGroup, Label, Input, Button } from "reactstrap";

const categories = [
  "Contracted Performer",
  "Featured Artist",
  "Non Featured Artist",
  "Studio Personnel",
];

const roles = [
  "Composer",
  "Producer",
  "A&R Administration",
  "A&R Assistant",
  "A&R Coordination",
  "A&R Direction",
  "A&R Manager",
  "Accordina",
  "Accordion",
  "Actor",
  "Agent",
  "Album Sequencer",
  "All Instruments",
  "Animator",
  "Announcer",
  "Applause",
  "Archlute",
  "Arghoul",
  "Arranger",
  "Art Director",
  "Artwork By",
  "Assistant",
  "Audio",
  "Author",
  "Autoharp",
  "Backline",
  "Baglamas",
  "Bagpipes",
  "Ballet Company",
  "Band Member",
  "Bandolim",
  "Bandonéon",
  "Banjo",
  "Barrel Organ",
  "Baryton",
  "Bass",
  "Bass Viol",
  "Bass-Baritone",
  "Bassoon",
  "Beats",
  "Bells",
  "Berimbau",
  "Bodhran",
  "Bouzouki",
  "Boy Soprano",
  "Brass",
  "Brass Band",
  "Brass Ensemble",
  "Bugle",
  "Cajón",
  "Calabash",
  "Camera",
  "Cantor",
  "Castanets",
  "Cavaco",
  "Cavaquinho",
  "Cello",
  "Chamberlain Strings",
  "Chimes",
  "Chitaronne",
  "Choir",
  "Choreographer",
  "Chorus",
  "Cinematographer",
  "Cittern",
  "Claghorn",
  "Claps",
  "Clarinet",
  "Clavichord",
  "Clavinet",
  "Clavinova",
  "Commentator",
  "Compilation Artist",
  "Compiled By",
  "Compiler",
  "Concertina",
  "Concertmaster",
  "Conch",
  "Conductor",
  "Congas",
  "Congoni",
  "Contra-Bassoon",
  "Cor Anglais",
  "Cornamuse",
  "Cornet",
  "Cornett",
  "Cornetto",
  "Coro",
  "Creator",
  "Crotales",
  "Crumhorn",
  "Cuts by",
  "Cuíca",
  "Cymbals",
  "DJ",
  "Dance Company",
  "Dancer",
  "Designer",
  "Didgeridoo",
  "Director",
  "Djembe",
  "Dobro",
  "Domra",
  "Double Bass",
  "Drums",
  "Dulcian",
  "Dulcimer",
  "EWI",
  "Editor",
  "Electric Bass",
  "Electronics",
  "Engineer",
  "Ensemble",
  "Erhu",
  "Esraj",
  "Euphonium",
  "Fiddle",
  "Film",
  "Flageolet",
  "Flugelhorn",
  "Flute",
  "Footsteps",
  "Fortepiano",
  "French Horn",
  "Fujara",
  "Ganzá",
  "Ghatam",
  "Gittern",
  "Glass Harp",
  "Glockenspiel",
  "Gong",
  "Gourd",
  "Guitar",
  "Guitarra",
  "Guitarviol",
  "Hackbrett",
  "Hammond organ",
  "Hand Clap",
  "Harmonica",
  "Harmonium",
  "Harmonizer",
  "Harp",
  "Harpsichord",
  "Horn",
  "Hurdy-gurdy",
  "Instrumentation",
  "Instruments",
  "Interviewee",
  "Interviewer",
  "Intérprete",
  "Jaleo",
  "Jew's Harp",
  "Kaval",
  "Keyboards",
  "Keytar",
  "Khene",
  "Kora",
  "Koto",
  "Lamellophone",
  "Language Supervision",
  "Leader",
  "Librettist",
  "Loops",
  "Lute",
  "Lyra",
  "Lyre",
  "Lyricon",
  "Main MC",
  "Mandola",
  "Mandolin",
  "Marimba",
  "Marketing",
  "Masterer",
  "Mediaeval Fiddle",
  "Mellotron",
  "Melodica",
  "Mixer",
  "Moog",
  "Mridangam",
  "Music",
  "Musicians",
  "Nai",
  "Narrator",
  "Natural Horn",
  "Natural Trumpet",
  "Nyckelharpa",
  "Oboe",
  "Oboe d'amore",
  "Oboe da caccia",
  "Ondes Martenot",
  "Ophicleide",
  "Orchestra",
  "Orchestra Leader",
  "Orchestrionics",
  "Organ",
  "Organistrum",
  "Pandeiro",
  "Panpipes",
  "Percussion",
  "Performance",
  "Photographer",
  "Piano",
  "Piano Duo",
  "Piano Quartet",
  "Piano Trio",
  "Piccolo",
  "Pipa",
  "Pipe",
  "Portativ",
  "Presenter",
  "Pro Tools",
  "Production",
  "Programmer",
  "Programming",
  "Psaltery",
  "Publisher",
  "Quanoun",
  "Rap",
  "Re-producer",
  "Re-worker",
  "Rebab",
  "Rebec",
  "Reconstruction",
  "Recorded by",
  "Recorder",
  "Reeds",
  "Remix",
  "Remixer",
  "Repique",
  "Req",
  "Requinto Jarocho",
  "Rhythms",
  "Ringtone Creator",
  "Rubboard",
  "Sackbut",
  "Sagat",
  "Sampler",
  "Samples",
  "Saw",
  "Saxophone",
  "Saz",
  "Schalmei",
  "Scratch",
  "Set Dressing",
  "Shaker",
  "Shakuhachi",
  "Shamisen",
  "Shawm",
  "Sitar",
  "Sou",
  "Sound Effects (SFX)",
  "Sousaphone",
  "Spinet",
  "String Orchestra",
  "String Quartet",
  "String Trio",
  "Strings",
  "Studio Dog",
  "Supervisor",
  "Surdo",
  "Swing Gang",
  "Synfonia",
  "Synthesizer",
  "Tabla",
  "Talkbox",
  "Tambourine",
  "Tambura",
  "Tanbur",
  "Tape",
  "Tar",
  "Tavil",
  "Technician",
  "Telinka",
  "Theorbo",
  "Theremin",
  "Timpani",
  "Tin Whistle",
  "Tracklaying",
  "Translator",
  "Treble Viol",
  "Triangle",
  "Trombone",
  "Trumpet",
  "Tuba",
  "Turntables",
  "Tzouras",
  "Ukulele",
  "Vibes",
  "Vibraphone",
  "Video Effects (VFX)",
  "Vielle",
  "Vihuela",
  "Viol",
  "Viola",
  "Viola d'amore",
  "Viola da Gamba",
  "Violin",
  "Violino",
  "Violoncello",
  "Violone",
  "Virginal",
  "Vocal & Instrumental Ensemble",
  "Vocal Bed",
  "Vocal Ensemble",
  "Vocals",
  "Vocoder",
  "Voice",
  "Voice Over",
  "Voices",
  "Washboard",
  "Whistle",
  "Wind Ensemble",
  "Woodwind",
  "Woodwinds",
  "Words",
  "Wurlitzer",
  "Xylophone",
  "Xylorimba",
  "Zither",
];

const roleTypes = {
  Composer: [
    "Additional",
    "All Music by",
    "Arrangement",
    "Co-Composer",
    "Composition",
    "Featured",
    "Music",
    "Music by",
    "Original",
    "Other Synths",
    "Vocal",
  ],
  Producer: [
    "Additional",
    "Assistant",
    "Executive",
    "Producer",
    "Remix & Production",
    "Recording",
    "Original",
    "Featured",
    "Vocal",
    "Film",
    "Series",
    "Video",
  ],
  Vocals: [
    "Additional Vocal Effects",
    "Additional Vocal Recording",
    "Additional Vocals",
    "Boy Alto",
    "Boy Soprano",
    "Choral Backing Vocals",
    "Chorister",
    "Choir",
    "Counter-Tenor",
    "Descant",
    "Duet",
    "Falsetto",
    "Female Chorus",
    "Junior Vocals",
    "Lead",
    "Lead Vocal Recording",
    "Mezzo-Soprano",
    "Rapper",
    "Solo",
    "Solo Domra",
    "Solo Soprano",
    "Soprano",
    "Spoken Voice",
    "Vocal",
    "Vocal & Instrumental Ensemble",
    "Vocal Bed",
    "Vocal Direction Assistant",
    "Vocal Ensemble",
    "Vocal Recording",
    "Voice",
    "Voice Over",
    "Voices",
    "Whispers",
    "Yells",
  ],
};

// Only roles that have a list in roleTypes require Role Type
const roleHasTypes = (role) =>
  Array.isArray(roleTypes[role]) && roleTypes[role].length > 0;

const ContributorsList = ({ contributors, setContributors, readOnly = false }) => {
  const [activeContributorIndex, setActiveContributorIndex] = useState(null);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);

  const token = localStorage.getItem("woss_token");
  const releaseId = localStorage.getItem("currentReleaseId");

  const blockIfReadOnly = (e) => {
    if (!readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    // blur to avoid keyboard interaction
    if (e.currentTarget && typeof e.currentTarget.blur === "function") {
      e.currentTarget.blur();
    }
  };

  const handleSelectorChange = (index, field, value) => {
    if (readOnly) return; // hard guard: do nothing if read-only
    const updated = [...contributors];
    updated[index][field] = value;

    // Reset roleType if role changes
    if (field === "role") {
      updated[index].roleType = "";
    }

    setContributors(updated);
    saveContributorsToRelease(updated); // persist
  };

  const saveContributorsToRelease = async (contributorList) => {
    try {
      const res = await fetch(`http://localhost:4000/api/user/releases/${releaseId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contributors_json: JSON.stringify(contributorList),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        console.warn("❌ Failed to save contributors to release.");
      }
    } catch (err) {
      console.error("❌ Error saving contributors to release:", err);
    }
  };

  const toggleMenuModal = (index = null) => {
    setActiveContributorIndex(index);
    setIsMenuModalOpen((prev) => !prev);
  };

  const handleDeleteContributor = async (contributorId) => {
    try {
      const res = await fetch(
        `http://localhost:4000/api/user/releases/${releaseId}/contributors/${contributorId}/disconnect`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();

      if (data.success) {
        const updated = contributors.filter((c) => c.id !== contributorId);
        setContributors(updated);
        saveContributorsToRelease(updated);

        setIsMenuModalOpen(false);
        setActiveContributorIndex(null);
      } else {
        alert("Failed to disconnect contributor: " + data.message);
      }
    } catch (err) {
      console.error("Error disconnecting contributor:", err);
      alert("Server error while disconnecting contributor.");
    }
  };

  return (
    <div className="sortable-container mt-2">
      {contributors.map((contributor, index) => {
        const needsRoleType = roleHasTypes(contributor.role);

        return (
          <div key={index} className="contributor-item p-3">
            <div className="d-flex justify-content-between align-items-center">
              <p className="contributor-name mb-3">
                <i className="fa fa-microphone"></i> {contributor.name}
              </p>
              <div className="three-dots-container">
                <button
                  className={`three-pointer-menu ${
                    activeContributorIndex === index ? "hidden" : ""
                  }`}
                  disabled={activeContributorIndex === index}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMenuModal(index);
                  }}
                >
                  <i className="fas fa-ellipsis-v"></i>
                </button>
              </div>
            </div>

            <div className="d-flex flex-wrap gap-4 input-container-contributor">
              <FormGroup className="selector-item-contributor">
                <Label className="contributor-info">Category</Label>
                <Input
                  type="select"
                  className={`select-contributor ${!contributor.category ? "border-warning" : ""}`}
                  value={contributor.category || ""}
                  onChange={(e) => handleSelectorChange(index, "category", e.target.value)}
                  onMouseDown={blockIfReadOnly}
                  onKeyDown={blockIfReadOnly}
                  tabIndex={readOnly ? -1 : 0}
                  aria-disabled={readOnly}
                  style={readOnly ? { cursor: "not-allowed" } : undefined}
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </Input>
              </FormGroup>

              <FormGroup className="selector-item-contributor">
                <Label className="contributor-info">Role</Label>
                <Input
                  type="select"
                  className={`select-contributor ${!contributor.role ? "border-warning" : ""}`}
                  value={contributor.role || ""}
                  onChange={(e) => handleSelectorChange(index, "role", e.target.value)}
                  onMouseDown={blockIfReadOnly}
                  onKeyDown={blockIfReadOnly}
                  tabIndex={readOnly ? -1 : 0}
                  aria-disabled={readOnly}
                  style={readOnly ? { cursor: "not-allowed" } : undefined}
                >
                  <option value="">Select Role</option>
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </Input>
              </FormGroup>

              {needsRoleType && (
                <FormGroup className="selector-item-contributor">
                  <Label className="contributor-info">Role Type</Label>
                  <Input
                    type="select"
                    className={`select-contributor ${
                      needsRoleType && !contributor.roleType ? "border-warning" : ""
                    }`}
                    value={contributor.roleType || ""}
                    onChange={(e) => handleSelectorChange(index, "roleType", e.target.value)}
                    onMouseDown={blockIfReadOnly}
                    onKeyDown={blockIfReadOnly}
                    tabIndex={readOnly ? -1 : 0}
                    aria-disabled={readOnly}
                    style={readOnly ? { cursor: "not-allowed" } : undefined}
                  >
                    <option value="">Select Role Type</option>
                    {roleTypes[contributor.role]?.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Input>
                </FormGroup>
              )}
            </div>
          </div>
        );
      })}

      {isMenuModalOpen && (
        <>
          <div className="overlay" onClick={toggleMenuModal}></div>
          <div className="contributor-remove-modal">
            <h3 className="text-white mb-3 text-center">Remove Contributor</h3>
            <button className="close-button" onClick={toggleMenuModal}>
              &times;
            </button>
            <p className="text-white mb-4 small">
              Are you sure you want to remove{" "}
              <strong className="h5 font-weight-500 text-secondary">
                "{contributors[activeContributorIndex]?.name}"
              </strong>{" "}
              from this release?
            </p>
            <div className="d-flex justify-content-center gap-3">
              <Button
                color="darker"
                onClick={() => {
                  setIsMenuModalOpen(false);
                  setActiveContributorIndex(null);
                }}
              >
                Cancel
              </Button>
              <Button
                color="secondary"
                onClick={() =>
                  handleDeleteContributor(contributors[activeContributorIndex]?.id)
                }
              >
                <i className="fas fa-times"></i> Remove
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ContributorsList;
