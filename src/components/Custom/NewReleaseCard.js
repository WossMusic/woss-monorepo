import React, { useState, useEffect } from "react";
import { Card, CardBody, Row, Col } from "reactstrap";
import '@fortawesome/fontawesome-free/css/all.min.css';

const NewReleaseCard = ({
    releaseId,
    releaseTitle,
    displayTitle,   
    releaseArtists,
    releaseDate,
    releaseGenre,
    releaseType,
    releaseFormat,
    project,
    audioLanguage,
    gpidType,
    code,
    label,
    cLineYear,
    cLineOwner,
    userProfile,
}) => {
    const [releaseImage, setReleaseImage] = useState(null);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [fadeClass, setFadeClass] = useState("");
    const [releaseImageUrl, setReleaseImageUrl] = useState(null);

    useEffect(() => {
        const fetchArtwork = async () => {
          const releaseId = localStorage.getItem("currentReleaseId");
          const token = localStorage.getItem("woss_token");
      
          if (!releaseId || !token) return;
      
          try {
            const res = await fetch(`http://localhost:4000/api/user/releases/${releaseId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success && data.release?.artwork_url) {
              setReleaseImageUrl(`http://localhost:4000${data.release.artwork_url}`);
            }
          } catch (err) {
            console.error("Error fetching release artwork:", err);
          }
        };
      
        fetchArtwork();
      }, []);
    

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const validFormats = ["image/jpeg", "image/jpg", "image/tiff"];
            if (!validFormats.includes(file.type)) {
                setError(
                    <div>
                        <strong className="alert-title">Cover Art Requirements:</strong>
                        <ul className="alert-list mt-2 mb-0">
                            <li>Perfectly square image from 1400x1400 to 4000x4000 pixels.</li>
                            <li>Image Format: .jpg or .tif in RGB color mode (not CMYK).</li>
                            <li>
                                IMPORTANT: Layered files or files with alpha color channels are NOT ACCEPTED.
                            </li>
                        </ul>
                    </div>
                );
                
                return;
            }

            const formData = new FormData();
            formData.append("artwork", file); // the File object
            const token = localStorage.getItem("woss_token");

            await fetch(`http://localhost:4000/api/user/releases/${releaseId}/artwork`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
            },
            body: formData,
            });


            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    if (img.width !== img.height || img.width < 1400 || img.width > 4000) {
                        setError(
                            <div>
                                <strong className="alert-title">Cover Art Requirements:</strong>
                                <ul className="alert-list mt-2 mb-0">
                                    <li>Perfectly square image from 1400x1400 to 4000x4000 pixels.</li>
                                    <li>Image Format: .jpg or .tif in RGB color mode (not CMYK).</li>
                                    <li>
                                        IMPORTANT: Layered files or files with alpha color channels are NOT ACCEPTED.
                                    </li>
                                </ul>
                            </div>
                        );
                    } else {
                        setError(null);
                        setReleaseImage(event.target.result);
                        setSuccess(true);
                        setFadeClass("fade-in");
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => {
                setFadeClass("fade-out");
                setTimeout(() => setSuccess(false), 2000);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    useEffect(() => {
        if (!releaseId) return;
    
        const fetchArtwork = async () => {
            try {
                const token = localStorage.getItem("woss_token");
                const res = await fetch(`http://localhost:4000/api/user/releases/${releaseId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                const data = await res.json();
                if (data.success && data.release?.artwork_url) {
                    setReleaseImageUrl(`http://localhost:4000${data.release.artwork_url}`);
                }
            } catch (err) {
                console.error("Failed to load release artwork:", err);
            }
        };
    
        fetchArtwork();
    }, [releaseId]);
    

    return (
        <>
            {(success || error) && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        zIndex: 1049,
                    }}
                ></div>
            )}

            {success && (
                <div
                    className={`alert alert-success position-fixed ${fadeClass}`}
                    style={{
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        zIndex: 1050,
                        width: "350px",
                        padding: "20px",
                        textAlign: "center",
                        borderRadius: "8px",
                        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        transition: "opacity 2s ease-in-out",
                    }}
                    role="alert"
                >
                    <strong className="alert-title" style={{ marginBottom: "10px" }}>
                        Success!
                    </strong>
                    <p>Your image was uploaded!</p>
                </div>
            )}

            {error && (
                <div
                    className="alert alert-danger position-fixed"
                    style={{
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        zIndex: 1050,
                        width: "350px",
                        padding: "20px",
                        textAlign: "left",
                        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        position: "relative",
                    }}
                    role="alert"
                >
                    <button
                        type="button"
                        className="close"
                        style={{
                            position: "absolute",
                            top: "10px",
                            right: "10px",
                            fontSize: "1.2rem",
                        }}
                        aria-label="Close"
                        onClick={() => setError(null)}
                    >
                        &times;
                    </button>
                    {error}
                </div>
            )}

            <Card className="shadow-release-card bg-dark">
                <CardBody>
                    <Row className="align-items-center flex-column flex-md-row text-center text-md-left">
                        {/* Image Container */}
                        <div
                            className="image-container"
                            style={{
                                position: "relative",
                                width: "300px",
                                height: "300px",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                margin: "20px auto",
                                maxWidth: "90%",
                            }}
                        >
                            <label
                                htmlFor="image-upload"
                                className={`upload-label w-100 h-100 d-flex justify-content-center align-items-center ${releaseImage ? "uploaded" : ""}`}
                                style={{ cursor: "pointer" }}
                            >
                                {releaseImage || releaseImageUrl ? (
                                <img
                                    src={releaseImage || releaseImageUrl}
                                    alt="Cover Art"
                                    className="release-image"
                                    style={{
                                    objectFit: "cover",
                                    width: "100%",
                                    height: "100%",
                                    }}
                                />
                                ) : (
                                <div>
                                    <i className="fa fa-upload"></i> Upload Cover Art
                                </div>
                                )}
                            </label>
                            <input
                                type="file"
                                id="image-upload"
                                accept=".jpg,.jpeg,.tif"
                                style={{ display: "none" }}
                                onChange={handleImageUpload}
                            />
                        </div>

                        <Col xs="12" md="9" className="title-section">
                        <h2 className="text-white release-title">{displayTitle || " "}</h2>
                        <div className="info-section mt-0">

                            <div className="mt-2">
                            <p className="small">
                                <strong className="custom-label contributor-info">Release Artist</strong>{" "}
                                {releaseType === "Single" ? releaseArtists : project}
                                </p>

                            </div>

                            <div className="mb-0">
                            <p className="small mt-2">
                                <span
                                style={{
                                    backgroundColor: "#56BCB6",
                                    color: "#fff",
                                    padding: "5px 10px",
                                    borderRadius: "15px",
                                    fontSize: "12px",
                                    fontWeight: "bold",
                                    marginRight: "10px",
                                }}
                                >
                                {gpidType}
                                </span>
                                <span style={{ margin: 0, padding: 0 }}>{code}</span>
                            </p>
                            </div>


                            
                            {/* 🔄 Swapped: Project and Release Date */}
                            <div className="mt-2 mb-2">
                            <p className="small">
                            <strong className="custom-label contributor-info">Release Date</strong>{" "}
                           {releaseDate ? new Date(releaseDate + "T00:00:00").toLocaleDateString(navigator.language, {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit"
                            }) : "—"}
                            </p>
                            </div>



                            <div className="mt-2">
                            <p className="small">
                                <strong className="custom-label contributor-info">Label</strong> {label}
                            </p>
                            </div>


                            <div className="mb-2">
                             <p className="small mt-0">
                                <strong className="custom-label contributor-info">Release Genre</strong> {releaseGenre}
                             </p>
                            </div>



                            <div className="mb-2">
                            <p className="small">
                                <strong className="custom-label contributor-info">Project</strong> {project}
                            </p>
                            </div>


                            {/* 🔄 Swapped: Release Format and Language */}
                            <div className="mb-2">
                            <p className="small">
                                <strong className="custom-label contributor-info">Release Format</strong> {releaseFormat}
                            </p>
                            </div>


                            <div className="mb-2">
                            <p className="small">
                                <strong className="custom-label contributor-info">Language</strong> {audioLanguage}
                            </p>
                            </div>
                      
                        
                        <div className="mb-2">
                            <p className="small">
                                <strong className="custom-label contributor-info">(C) Year/Owner</strong>{" "}
                                {cLineYear
                                ? `${cLineYear} ${
                                    userProfile?.role === "Distributor"
                                        ? cLineOwner.split(" / Distributed by")[0].trim()
                                        : label
                                    }`
                                : "—"}
                            </p>
                        </div>


                            <div className="mb-2">
                                <p className="small">
                                    <strong className="custom-label contributor-info">Release Type</strong> {releaseType}
                                </p>
                            </div>


                          </div>
                      </Col>
                   </Row>
             </CardBody>
       </Card>
    </>
  );
};

export default NewReleaseCard;
