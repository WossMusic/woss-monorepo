import React, { useState, useEffect } from "react";
import { Label, Input, Button } from "reactstrap";
import "assets/css/ContributorsModal.css";

  const ContributorsModal = ({ res, isOpen, toggle, contributor, contributors, setContributor, setContributors, saveTrackField, file }) => {
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [frequentContributors, setFrequentContributors] = useState([]);
  const [inputValue, setInputValue] = useState("");

  const token = localStorage.getItem("woss_token");
  const releaseId = localStorage.getItem("currentReleaseId");

  useEffect(() => {
    const timer = setTimeout(() => {
      setContributor({ name: inputValue });
    }, 250);

    return () => clearTimeout(timer);
  }, [inputValue, setContributor]);

  useEffect(() => {
    const fetchFrequentContributors = async () => {
      try {
        const res = await fetch("http://localhost:4000/api/user/contributors/frequent", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setFrequentContributors(data.contributors || []);
        }
      } catch (err) {
        console.error("❌ Error loading frequent contributors:", err);
      }
    };

    if (isOpen) {
      fetchFrequentContributors();
    }
  }, [isOpen, token]);

  useEffect(() => {
    if (!isOpen) {
      setContributor({ name: "" });
      setInputValue("");
      setSearchResults([]);
    }
  }, [isOpen, setContributor]);

  useEffect(() => {
    if (!isOpen || !contributor.name.trim()) {
      setSearchResults([]);
      return;
    }

    const fetchResults = async () => {
      try {
        setLoading(true);
        const res = await fetch(`http://localhost:4000/api/user/releases/${releaseId}/contributors/search?name=${contributor.name}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.results || []);
        }
      } catch (err) {
        console.error("Error searching contributors:", err);
      } finally {
        setLoading(false);
      }
    };

    const timeout = setTimeout(fetchResults, 300);
    return () => clearTimeout(timeout);
  }, [contributor.name, isOpen, releaseId, token]);

  const handleSelectResult = async (name) => {
    try {
      const res = await fetch(`http://localhost:4000/api/user/releases/${releaseId}/contributors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ contributor_name: name }),
      });
  
      const data = await res.json();
  
      if (data.success && data.id) {
        const newContributor = {
          id: data.id,
          name,
          category: "",
          role: "",
          roleType: "",
        };
  
        const updatedContributors = [...contributors, newContributor];
  
        setContributors(updatedContributors);
  
        // ✅ Save to track if in a track context (file is passed)
        if (file && saveTrackField) {
          saveTrackField(file.id, "track_contributors_json", JSON.stringify(updatedContributors));
        } 
      }
  
      // Reset form
      setContributor({ name: "" });
      setInputValue("");
      setSearchResults([]);
      toggle();
    } catch (err) {
      console.error("Error selecting contributor:", err);
      alert("Could not add contributor. See console.");
    }
  };
  
  

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contributor.name.trim()) return;

    setLoading(true);

    try {
      const res = await fetch(`http://localhost:4000/api/user/releases/${releaseId}/contributors`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contributor_name: contributor.name }),
      });

      const data = await res.json();
      if (data.success && data.id) {
        setContributors((prev) => [
          ...prev,
          {
            id: data.id, // ✅ must be the DB ID
            name: contributor.name,
            category: "",
            role: "",
            roleType: "",
          },
        ]);
      } else {
        alert("Error saving contributor: " + (data.message || "Unknown error"));
      }

      setContributor({ name: "" });
      setInputValue("");
      setSearchResults([]);
      toggle();
    } catch (err) {
      console.error("Error saving contributor:", err);
      alert("Error saving contributor. See console.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // ✅ MOVE THIS PART BEFORE RETURN
  const filteredResults = searchResults.filter(res => {
    const contributorName = res.contributor_name.toLowerCase();
    const searchText = inputValue.toLowerCase().trim();
    return contributorName.startsWith(searchText);
  });
  

  return (
    <>
      <div className="new-container-overlay" onClick={toggle}></div>
      <div className="styled-contributor-modal">
        <h3 className="modal-title text-white mt--2">Add New Contributor</h3>
        <button className="close-button" onClick={toggle}>
          &times;
        </button>
        <hr className="mt--1" />
        <form onSubmit={handleSubmit} className="styled-contributor-form">
          {/* Input */}
          <div className="search-container">
            <Label htmlFor="contributorName" className="input-label mt--2">
              Contributor Name
            </Label>

            <Input
              id="contributorName"
              className="styled-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter or search contributor name"
              autoComplete="off"
              required
            />
          </div>

          {/* Contributor List */}
          <div className="frequent-container">
            <div className="frequent-header">
              {contributor.name.trim() === ""
                ? "Your Frequently Used Contributors"
                : loading
                  ? "Searching contributors..."
                  : filteredResults.length > 0
                    ? `${filteredResults.length} Contributor${filteredResults.length > 1 ? "s" : ""} found`
                    : "No contributors found"}
            </div>

            <div className="frequent-list" style={{ maxHeight: "220px", overflowY: "auto" }}>
              {contributor.name.trim() === "" ? (
                <>
                  {frequentContributors.map((item, index) => (
                    <div key={index} className="result-item" onClick={() => handleSelectResult(item.name)}>
                      <div className="result-left">
                        <div className="result-icon"><i className="fas fa-user"></i></div>
                        <div className="result-details">
                          <div className="contributor-name mt-2">{item.name}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {[...Array(Math.max(0, 3 - frequentContributors.length))].map((_, idx) => (
                    <div key={`spacer-frequent-${idx}`} className="result-item placeholder" style={{ visibility: "hidden" }} />
                  ))}
                </>
              ) : loading ? (
                [...Array(3)].map((_, idx) => (
                  <div key={`loading-${idx}`} className="result-item placeholder">
                    <div className="result-left">
                      <div className="result-icon"><i className="fas fa-spinner fa-spin"></i></div>
                      <div className="result-details mt-2">
                        <div className="contributor-name placeholder-text">Searching...</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : filteredResults.length > 0 ? (
                <>
                  {filteredResults.map((res, index) => (
                    <div key={index} className="result-item" onClick={() => handleSelectResult(res.contributor_name)}>
                      <div className="result-left">
                        <div className="result-icon"><i className="fas fa-user"></i></div>
                        <div className="result-details">
                          <div className="contributor-name mt-2">{res.contributor_name}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {[...Array(Math.max(0, 3 - filteredResults.length))].map((_, idx) => (
                    <div key={`spacer-search-${idx}`} className="result-item placeholder" style={{ visibility: "hidden" }} />
                  ))}
                </>
              ) : (
                [...Array(3)].map((_, idx) => (
                  <div key={`spacer-no-result-${idx}`} className="result-item placeholder" style={{ visibility: "hidden" }} />
                ))
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="styled-button-container mt-4">
            <Button type="button" className="btn-darker" onClick={toggle}>
              Cancel
            </Button>
            <Button type="submit" className="btn-secondary" disabled={loading}>
              <i className="fas fa-plus me-2"></i> Add Contributor
            </Button>
          </div>
        </form>
      </div>
    </>
  );
};

export default ContributorsModal;
