import React, { useState, useEffect } from "react";
import { Label, Input, Button } from "reactstrap";
import "assets/css/ContributorsModal.css"; // Reuse existing styles

const ArtistsModal = ({ isOpen, toggle, addArtistToList, openCreateArtistModal }) => {
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [frequentArtists, setFrequentArtists] = useState([]);
  const [inputValue, setInputValue] = useState("");

  const token = localStorage.getItem("woss_token");
  const releaseId = localStorage.getItem("currentReleaseId");

  // ===== helpers =====
  const extractName = (a) =>
    String(a?.artist_name ?? a?.name ?? a ?? "").trim();

  async function persistArtistToRelease(releaseId, name, token) {
    const res = await fetch(
      `http://localhost:4000/api/user/releases/${releaseId}/artists`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ artist_name: name }),
      }
    );
    const data = await res.json();
    if (!res.ok || !data?.success) {
      throw new Error(data?.message || "Failed to add artist");
    }
    // API returns { success, id, artists: [...] }
    return { id: data.id, name };
  }

  // ✅ Fetch Frequent Artists (when modal opens)
  useEffect(() => {
    const fetchFrequentArtists = async () => {
      try {
        const res = await fetch("http://localhost:4000/api/user/artists/frequent", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setFrequentArtists(data.artists || []);
      } catch (err) {
        console.error("❌ Error loading frequent artists:", err);
      }
    };

    if (isOpen) fetchFrequentArtists();
  }, [isOpen, token]);

  // ✅ Search Artists (when typing)
  useEffect(() => {
    if (!isOpen || !inputValue.trim()) {
      setSearchResults([]);
      return;
    }

    const fetchResults = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `http://localhost:4000/api/user/releases/${releaseId}/artists/search?name=${encodeURIComponent(
            inputValue
          )}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (data.success) setSearchResults(data.results || []);
      } catch (err) {
        console.error("Error searching artists:", err);
      } finally {
        setLoading(false);
      }
    };

    const timeout = setTimeout(fetchResults, 300);
    return () => clearTimeout(timeout);
  }, [inputValue, isOpen, token, releaseId]);

  // ✅ Persist, then update UI
  const handleSelectArtist = async (artist) => {
    const name = extractName(artist);
    if (!name) return;

    try {
      const saved = await persistArtistToRelease(releaseId, name, token);

      // Update parent list (UI) immediately
      addArtistToList({ id: saved.id ?? Date.now(), displayName: saved.name });

      // Close & reset
      toggle();
      setInputValue("");
      setSearchResults([]);
    } catch (err) {
      console.error("❌ Add artist failed:", err);
      // TODO: show toast/toaster if you use one
    }
  };

  // Enter key adds typed value
  const onInputKeyDown = async (e) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      await handleSelectArtist({ artist_name: inputValue.trim() });
    }
  };

  if (!isOpen) return null;

  const filteredResults = searchResults.filter((res) =>
    extractName(res).toLowerCase().startsWith(inputValue.toLowerCase())
  );

  return (
    <>
      <div className="new-container-overlay" onClick={toggle}></div>
      <div className="styled-contributor-modal">
        <h3 className="modal-title text-white">Add Artist</h3>
        <button className="close-button" onClick={toggle}>
          &times;
        </button>

        <form className="styled-contributor-form" onSubmit={(e) => e.preventDefault()}>
          {/* Search Input */}
          <div className="search-container">
            <Label htmlFor="artistName" className="input-label mt--2">
              Artist Name
            </Label>
            <Input
              id="artistName"
              className="styled-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Enter or search artist name"
              autoComplete="off"
            />
          </div>

          {/* List */}
          <div className="frequent-container">
            <div className="frequent-header">
              {inputValue.trim() === ""
                ? "Your Frequently Used Artists"
                : loading
                ? "Searching..."
                : filteredResults.length > 0
                ? `${filteredResults.length} Artist${filteredResults.length > 1 ? "s" : ""} found`
                : "No artists found"}
            </div>

            <div className="frequent-list" style={{ maxHeight: "220px", overflowY: "auto" }}>
              {/* Frequent Artists */}
              {inputValue.trim() === "" ? (
                <>
                  {frequentArtists.map((artist, index) => (
                    <div
                      key={index}
                      className="result-item"
                      onClick={() => handleSelectArtist(artist)}
                    >
                      <div className="result-left">
                        <div className="result-icon">
                          <i className="fas fa-user"></i>
                        </div>
                        <div className="result-details">
                          <div className="contributor-name mt-2">{artist.artist_name}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {[...Array(Math.max(0, 3 - frequentArtists.length))].map((_, idx) => (
                    <div
                      key={`spacer-frequent-${idx}`}
                      className="result-item placeholder"
                      style={{ visibility: "hidden" }}
                    />
                  ))}
                </>
              ) : (
                // Search Results
                <>
                  {filteredResults.length > 0 ? (
                    filteredResults.map((artist, index) => (
                      <div
                        key={index}
                        className="result-item"
                        onClick={() => handleSelectArtist(artist)}
                      >
                        <div className="result-left">
                          <div className="result-icon">
                            <i className="fas fa-user"></i>
                          </div>
                          <div className="result-details">
                            <div className="contributor-name mt-2">
                              {extractName(artist)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center mt-3">
                      <Button color="secondary" onClick={openCreateArtistModal}>
                        <i className="fas fa-plus me-2"></i> Create New Artist
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="styled-button-container mt-4">
            <Button type="button" className="btn-darker" onClick={toggle}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </>
  );
};

export default ArtistsModal;
