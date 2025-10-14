import React, { useState, useEffect } from "react";
import { FormGroup, Label, Input, Button } from "reactstrap";
import ContributorsModal from "components/Custom/ContributorsModal";
import "assets/css/ContributorsModal.css";

const categories = [
  "Contracted Performer",
  "Featured Artist",
  "Non Featured Artist",
  "Studio Personnel",
];

const roles = ["Composer", "Producer"];

const roleTypes = {
  Composer: [
    "Additional",
    "All Music by",
    "Arrangement",
    "Co-Composer",
    "Composition",
    "Featured",
    "Music",
    "Music by Original",
    "Other Synths",
    "Vocal",
  ],
  Producer: [
    "Additional",
    "Assistant",
    "Executive",
    "Remix & Production",
    "Recording",
    "Original",
    "Featured",
    "Vocal",
    "Film",
    "Series",
    "Video",
  ],
};

// ✅ Only roles that exist in roleTypes require a Role Type
const roleHasTypes = (role) =>
  Array.isArray(roleTypes[role]) && roleTypes[role].length > 0;

const Contributors = ({
  contributors = [],
  setContributors,
  releaseType,
  file,
  saveTrackField,
  setTabWarnings,
}) => {
  if (!Array.isArray(contributors)) contributors = [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newContributor, setNewContributor] = useState({ name: "" });
  const toggleModal = () => setIsModalOpen(!isModalOpen);
  const token = localStorage.getItem("woss_token");

  const handleChange = (index, field, value) => {
    const updated = [...contributors];
    updated[index][field] = value;

    // Reset roleType if role changes
    if (field === "role") {
      updated[index].roleType = "";
    }

    setContributors(updated);

    // Save to DB
    saveTrackField(file.id, "track_contributors_json", JSON.stringify(updated));
  };

  const handleRemoveContributor = async (contributorId) => {
    if (!token || !file?.id) return;

    // Find the index of the first contributor with the matching ID
    const indexToRemove = contributors.findIndex((c) => c.id === contributorId);
    if (indexToRemove === -1) return;

    const updatedContributors = [...contributors];
    updatedContributors.splice(indexToRemove, 1); // ✅ Remove only the first match

    setContributors(updatedContributors); // ✅ Update UI immediately

    try {
      await fetch(`http://localhost:4000/api/user/tracks/${file.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          track_contributors_json: JSON.stringify(updatedContributors),
        }),
      });

      // Optional: re-sync with parent if needed
      saveTrackField(
        file.id,
        "track_contributors_json",
        JSON.stringify(updatedContributors)
      );
    } catch (err) {
      console.error("❌ Failed to remove contributor:", err);
    }
  };

  useEffect(() => {
    const initializeContributorsFromRelease = async () => {
      if (releaseType === "Single" && contributors.length === 0 && file?.id) {
        const releaseId = localStorage.getItem("currentReleaseId");
        const token = localStorage.getItem("woss_token");

        if (!releaseId || !token) return;

        try {
          const res = await fetch(
            `http://localhost:4000/api/user/releases/${releaseId}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          const data = await res.json();

          if (data.success && data.release?.contributors_json) {
            let parsed = [];
            try {
              parsed = JSON.parse(data.release.contributors_json || "[]");
            } catch (e) {
              console.warn("Invalid contributors_json format");
            }

            if (parsed.length > 0) {
              setContributors(parsed);

              await fetch(
                `http://localhost:4000/api/user/tracks/${file.id}`,
                {
                  method: "PUT",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    track_contributors_json: JSON.stringify(parsed),
                  }),
                }
              );
            }
          }
        } catch (err) {
          console.error("❌ Failed to initialize contributors:", err);
        }
      }
    };

    initializeContributorsFromRelease();
  }, [releaseType, file?.id, contributors.length, setContributors]);

  return (
    <>
      <div className="sortable-container mt-2">
        <label className="text-muted d-block mb-2">Contributors</label>
        {contributors.length > 0 ? (
          contributors.map((contributor, index) => {
            const needsRoleType = roleHasTypes(contributor.role);

            return (
              <div key={index} className="contributor-item p-3 bg-primary">
                <div className="d-flex justify-content-between align-items-center">
                  <p className="contributor-name mb-3">
                    <i className="fa fa-music"></i> {contributor.name}
                  </p>
                  {releaseType !== "Single" && (
                    <Button
                      size="sm"
                      color="danger"
                      className="ms-2"
                      onClick={() => handleRemoveContributor(contributor.id)}
                    >
                      <i className="fas fa-trash-alt"></i>
                    </Button>
                  )}
                </div>

                <div className="d-flex flex-wrap gap-4 input-container-contributor">
                  <FormGroup className="selector-item-contributor">
                    <Label className="contributor-info bg-dark">Category</Label>
                    {releaseType === "Single" ? (
                      <Input
                        type="text"
                        className="select-contributor"
                        value={contributor.category}
                        readOnly
                      />
                    ) : (
                      <Input
                        type="select"
                        className={`select-contributor ${
                          !contributor.category ? "border-warning" : ""
                        }`}
                        value={contributor.category || ""}
                        onChange={(e) =>
                          handleChange(index, "category", e.target.value)
                        }
                      >
                        <option value="">Select Category</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </Input>
                    )}
                  </FormGroup>

                  <FormGroup className="selector-item-contributor">
                    <Label className="contributor-info bg-dark">Role</Label>
                    {releaseType === "Single" ? (
                      <Input
                        type="text"
                        className="select-contributor"
                        value={contributor.role}
                        readOnly
                      />
                    ) : (
                      <Input
                        type="select"
                        className={`select-contributor ${
                          !contributor.role ? "border-warning" : ""
                        }`}
                        value={contributor.role || ""}
                        onChange={(e) =>
                          handleChange(index, "role", e.target.value)
                        }
                      >
                        <option value="">Select Role</option>
                        {roles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </Input>
                    )}
                  </FormGroup>

                  {needsRoleType && (
                    <FormGroup className="selector-item-contributor">
                      <Label className="contributor-info bg-dark">
                        Role Type
                      </Label>
                      {releaseType === "Single" ? (
                        <Input
                          type="text"
                          className="select-contributor"
                          value={contributor.roleType}
                          readOnly
                        />
                      ) : (
                        <Input
                          type="select"
                          className={`select-contributor ${
                            needsRoleType && !contributor.roleType
                              ? "border-warning"
                              : ""
                          }`}
                          value={contributor.roleType || ""}
                          onChange={(e) =>
                            handleChange(index, "roleType", e.target.value)
                          }
                        >
                          <option value="">Select Role Type</option>
                          {(roleTypes[contributor.role] || []).map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </Input>
                      )}
                    </FormGroup>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-warning"></p>
        )}
      </div>

      {["EP", "Album"].includes(releaseType) && (
        <>
          <Button color="primary" className="mt-3" onClick={toggleModal}>
            + Add New Contributor
          </Button>

          <ContributorsModal
            isOpen={isModalOpen}
            toggle={toggleModal}
            contributor={newContributor}
            setContributor={setNewContributor}
            setContributors={setContributors}
            contributors={contributors}
            saveTrackField={saveTrackField}
            file={file}
          />
        </>
      )}
    </>
  );
};

export default Contributors;
