import React, { useState } from "react";
import ReactDatetime from 'react-datetime';
import {
  Card,
  Container,
  Row,
  Col,
  Form,
  FormGroup,
  Label,
  Input,
  Button,
} from "reactstrap";
import "assets/css/argon-dashboard-pro-react.css";
import unlistedVideoImage from "assets/img/form-images/unlistedvideo.jpg";
import formatVideoImage from "assets/img/form-images/formatvideo.jpg";
import { FaYoutube, FaFilm } from "react-icons/fa";



function NewMusicVideo() {
  const [selectedForm, setSelectedForm] = useState("");
  
  const [formData, setFormData] = useState({
    videoTitle: "",
    releaseDate: null,
    recordLabel: "Woss Music",
    artistNames: [""], // Updated to handle multiple artists
    genre: "",
    explicit: false,
    videoLength: "",
    copyrightYear: new Date().getFullYear().toString(),
    audioISRC: "",
    youtubeLink: "",
    timecodeCover: "",
    videoDownloadLink: "",
  });

  const handleSelection = (formType) => {
    setSelectedForm((prevForm) => {
      const newForm = prevForm === formType ? "" : formType;
  
      // Reset form data only when switching to a new form
      if (newForm !== prevForm) {
        resetForm();
      }
  
      return newForm;
    });
  };

  // Function to reset form data
const resetForm = () => {
  setFormData({
    videoTitle: "",
    releaseDate: null,
    recordLabel: "Woss Music",
    artistNames: [""], // Reset to default
    genre: "",
    explicit: false,
    videoLength: "",
    copyrightYear: new Date().getFullYear().toString(),
    audioISRC: "",
    youtubeLink: "",
    timecodeCover: "",
    videoDownloadLink: "",
  });
};

  const handleChange = (e, index) => {
    const { name, value, type, checked } = e.target;
    
    if (name === "artistNames") {
      const newArtists = [...formData.artistNames];
      newArtists[index] = value;
      setFormData({ ...formData, artistNames: newArtists });
    } else {
      setFormData({
        ...formData,
        [name]: type === "checkbox" ? checked : value,
      });
    }
  };

  // Function to add new artist input
  const addArtistField = () => {
    setFormData({ ...formData, artistNames: [...formData.artistNames, ""] });
  };

  // Function to remove an artist input
  const removeArtistField = (index) => {
    const newArtists = [...formData.artistNames];
    newArtists.splice(index, 1);
    setFormData({ ...formData, artistNames: newArtists });
  };

  const renderForm = () => {
    switch (selectedForm) {
      case "youtubeClaim":
        return (
          <YouTubeClaimForm
            formData={formData}
            setFormData={setFormData}
            handleChange={handleChange}
            addArtistField={addArtistField}
            removeArtistField={removeArtistField}
          />
        );
      case "officialVideo":
        return (
          <OfficialVideoForm
            formData={formData}
            setFormData={setFormData}
            handleChange={handleChange}
            addArtistField={addArtistField}
            removeArtistField={removeArtistField}
          />
        );
      case "both":
        return (
          <BothForms
            formData={formData}
            setFormData={setFormData}
            handleChange={handleChange}
            addArtistField={addArtistField}
            removeArtistField={removeArtistField}
          />
        );
      default:
        return null;
    }
  };
  return (
    <Container className="mt-6" fluid>
      <Row className="justify-content-center">
        <Col md="10">
          <h2 className="text-center mb-4">Music Video Strategies</h2>
          <Row className="text-center justify-content-center">
            <Col xs="12" md="4" className="mb-2">
              <Button 
                color={selectedForm === "youtubeClaim" ? "primary" : "outline-primary"} 
                block 
                onClick={() => handleSelection("youtubeClaim")}
              >
                <FaYoutube className="me-2" /> YouTube Claim
              </Button>
            </Col>
            <Col xs="12" md="4" className="mb-2">
              <Button 
                color={selectedForm === "officialVideo" ? "primary" : "outline-primary"} 
                block 
                onClick={() => handleSelection("officialVideo")}
              >
                <FaFilm className="me-2" /> Music Video for DSP
              </Button>
            </Col>
            <Col xs="12" md="4" className="mb-2">
              <Button 
                color={selectedForm === "both" ? "primary" : "outline-primary"} 
                block 
                onClick={() => handleSelection("both")}
              >
                <FaYoutube className="me-2" />YouTube Claim + Music Video for DSP<FaFilm className="me-2" />
              </Button>
            </Col>
          </Row>

          {renderForm()}
        </Col>
      </Row>
    </Container>
  );
}

function YouTubeClaimForm({ formData, setFormData, handleChange, addArtistField, removeArtistField }) {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 30 }, (_, i) => currentYear - i);
  return (
    <Card className="shadow-card p-4 mt-4">
      <h2 className="text-center"><FaYoutube className="me-2 mt--1" /> YouTube Claim</h2>
      <hr className="mt-3"></hr>
      <Form>
             <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="videoTitle">Video Title <span className="text-danger">*</span></Label>
                  <p className="text-muted h5 fw-medium">Make sure it is written the same as the Project release.</p>
                  <Input type="text" name="videoTitle" id="videoTitle" placeholder="Enter Video Title" value={formData.videoTitle} onChange={handleChange} required />
              </FormGroup>

              <FormGroup className="mb-4">
          <Label className="font-weight-bold" for="artistName">
            Name of the artist(s) <span className="text-danger">*</span>
          </Label>
          {formData.artistNames.map((artist, index) => (
            <div key={index} className="d-flex mb-2">
              <Input
                type="text"
                name="artistNames"
                placeholder="Enter Artist(s) Name"
                value={artist}
                onChange={(e) => handleChange(e, index)}
                required
              />
              {index > 0 && (
                <Button color="danger" className="ms-2" onClick={() => removeArtistField(index)}>
                  &times;
                </Button>
              )}
            </div>
          ))}
          <Button color="primary" className="mt-2" onClick={addArtistField}>
            + Add Artist
          </Button>
        </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold">Release Date <span className="text-danger">*</span></Label>
                  <p className="text-muted h5 fw-medium">Day, Month, Year</p>
                  <ReactDatetime inputProps={{ placeholder: "Select Release Date" }} timeFormat={false} value={formData.releaseDate} onChange={(date) => setFormData({ ...formData, releaseDate: date })} />
              </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="recordLabel">Record Label</Label>
                  <Input type="text" name="recordLabel" id="recordLabel" placeholder="Enter Record Label" value={formData.recordLabel} readOnly/>
              </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="genre">Genre <span className="text-danger">*</span></Label>
                  <Input type="text" name="genre" id="genre" placeholder="Enter Genre" value={formData.genre} onChange={handleChange} required />
              </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold">
                  Is this video marked as Explicit? <span className="text-danger">*</span>
                  </Label>
                  <div className="d-flex align-items-center">
                  <div className="form-check mr-3">
                    <Input
                      type="radio"
                      name="explicit"
                      value="No"
                      id="explicitNo"
                      onChange={handleChange}
                      className="form-check-input"
                    />
                    <Label for="explicitNo" className="form-check-label ms-2">No</Label>
                  </div>
                  <div className="form-check ms-5"> {/* Increased margin here */}
                    <Input
                      type="radio"
                      name="explicit"
                      value="Yes"
                      id="explicitYes"
                      onChange={handleChange}
                      className="form-check-input"
                    />
                    <Label for="explicitYes" className="form-check-label ms-2">Yes</Label>
                  </div>
                  </div>
                  </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="videoLength">Video Length <span className="text-danger">*</span></Label>
                  <p className="text-muted h5 fw-medium">Example: 00:00:00</p>
                  <Input type="text" name="videoLength" id="videoLength" placeholder="Enter Video Length (e.g., 3:45)" value={formData.videoLength} onChange={handleChange} required />
              </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold">Copyright Disclaimer</Label>
                  <p className="text-muted h5 fw-medium">Year of production.</p>
                  <div className="d-flex align-items-center">
                      <Input type="select" name="copyrightYear" value={formData.copyrightYear} onChange={handleChange} style={{ maxWidth: "100px", marginRight: "10px" }} >
                          {years.map(year => (
                              <option key={year} value={year}>{year}</option>
                          ))}
                      </Input>
                      <Input type="text" value="Woss Music" readOnly style={{ backgroundColor: "#f8f9fa", width: "150px" }}/>
                  </div>
              </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="audioISRC">Audio ISRC <span className="text-danger">*</span></Label>
                  <p className="text-muted h5 fw-medium"><strong>NOTE:</strong> ISRCs are different from UPC codes.</p>
                  <Input type="text" name="audioISRC" id="audioISRC" placeholder="Enter Audio ISRC" value={formData.audioISRC} onChange={handleChange} required />
              </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="youtubeLink">YouTube Video Link <span className="text-danger">*</span></Label>
                  <p className="text-muted">
                      <strong>Please note:</strong>
                      <ul className="text-dark h5 fw-medium">
                          <li>Deliver the link marked as <strong>UNLISTED/HIDDEN</strong>.</li>
                          <li>Yes, it has already been published, just provide the <strong>public link</strong>.</li>
                      </ul>
                  </p>
                  <img src={unlistedVideoImage} alt="Hidden or Public Music Video" className="img-fluid mb-3" />
                  <Input type="url" name="youtubeLink" id="youtubeLink" placeholder="Enter YouTube Link" value={formData.youtubeLink} onChange={handleChange} required />
              </FormGroup>

        <Button color="primary" type="submit">Submit</Button>
      </Form>
    </Card>
  );
}

function OfficialVideoForm({ formData, setFormData, handleChange, addArtistField, removeArtistField }) {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 30 }, (_, i) => currentYear - i);
  return (
    <Card className="shadow-card p-4 mt-4">
      <h2 className="text-center"><FaFilm className="me-2 mt--1" /> Music Video for DSP</h2>
      <hr className="mt-3"></hr>
      <Form>
             <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="videoTitle">Video Title <span className="text-danger">*</span></Label>
                  <p className="text-muted h5 fw-medium">Make sure it is written the same as the Project release.</p>
                  <Input type="text" name="videoTitle" id="videoTitle" placeholder="Enter Video Title" value={formData.videoTitle} onChange={handleChange} required />
              </FormGroup>

              <FormGroup className="mb-4">
          <Label className="font-weight-bold" for="artistName">
            Name of the artist(s) <span className="text-danger">*</span>
          </Label>
          {formData.artistNames.map((artist, index) => (
            <div key={index} className="d-flex mb-2">
              <Input
                type="text"
                name="artistNames"
                placeholder="Enter Artist(s) Name"
                value={artist}
                onChange={(e) => handleChange(e, index)}
                required
              />
              {index > 0 && (
                <Button color="danger" className="ms-2" onClick={() => removeArtistField(index)}>
                  &times;
                </Button>
              )}
            </div>
          ))}
          <Button color="primary" className="mt-2" onClick={addArtistField}>
            + Add Artist
          </Button>
        </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold">Release Date <span className="text-danger">*</span></Label>
                  <p className="text-muted h5 fw-medium">Day, Month, Year</p>
                  <ReactDatetime inputProps={{ placeholder: "Select Release Date" }} timeFormat={false} value={formData.releaseDate} onChange={(date) => setFormData({ ...formData, releaseDate: date })} />
              </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="recordLabel">Record Label</Label>
                  <Input type="text" name="recordLabel" id="recordLabel" placeholder="Enter Record Label" value={formData.recordLabel} readOnly/>
              </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="genre">Genre <span className="text-danger">*</span></Label>
                  <Input type="text" name="genre" id="genre" placeholder="Enter Genre" value={formData.genre} onChange={handleChange} required />
              </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold">
                  Is this video marked as Explicit? <span className="text-danger">*</span>
                  </Label>
                  <div className="d-flex align-items-center">
                  <div className="form-check mr-3">
                    <Input
                      type="radio"
                      name="explicit"
                      value="No"
                      id="explicitNo"
                      onChange={handleChange}
                      className="form-check-input"
                    />
                    <Label for="explicitNo" className="form-check-label ms-2">No</Label>
                  </div>
                  <div className="form-check ms-5"> {/* Increased margin here */}
                    <Input
                      type="radio"
                      name="explicit"
                      value="Yes"
                      id="explicitYes"
                      onChange={handleChange}
                      className="form-check-input"
                    />
                    <Label for="explicitYes" className="form-check-label ms-2">Yes</Label>
                  </div>
                  </div>
                  </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="videoLength">Video Length <span className="text-danger">*</span></Label>
                  <p className="text-muted h5 fw-medium">Example: 00:00:00</p>
                  <Input type="text" name="videoLength" id="videoLength" placeholder="Enter Video Length (e.g., 3:45)" value={formData.videoLength} onChange={handleChange} required />
              </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold">Copyright Disclaimer</Label>
                  <p className="text-muted h5 fw-medium">Year of production.</p>
                  <div className="d-flex align-items-center">
                      <Input type="select" name="copyrightYear" value={formData.copyrightYear} onChange={handleChange} style={{ maxWidth: "100px", marginRight: "10px" }} >
                          {years.map(year => (
                              <option key={year} value={year}>{year}</option>
                          ))}
                      </Input>
                      <Input type="text" value="Woss Music" readOnly style={{ backgroundColor: "#f8f9fa", width: "150px" }}/>
                  </div>
              </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="audioISRC">Audio ISRC <span className="text-danger">*</span></Label>
                  <p className="text-muted h5 fw-medium"><strong>NOTE:</strong> ISRCs are different from UPC codes.</p>
                  <Input type="text" name="audioISRC" id="audioISRC" placeholder="Enter Audio ISRC" value={formData.audioISRC} onChange={handleChange} required />
              </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="videoDownloadLink">Music Video Download Link for DSPs <span className="text-danger">*</span></Label>
                  <p className="text-muted">
                      <strong>Please note:</strong>
                      <ul className="text-dark h5 fw-medium">
                          <li>1. <strong>Delivery</strong> the video on platforms such as: <strong>Dropbox, BOX or Google Drive (OPEN).</strong></li>
                          <li>2. The video format must be: <strong>Apple ProRes 422 HQ // .MOV // Stereo Audio // Maximum Size: 3840 x 2160 // FPS: 23.976 fps, 25 fps or 29.97 fps.</strong></li>
                          <li>3. The file can weigh more than 3GB, for this reason <strong>we recommend point 1.</strong></li>
                          <br></br>
                          <li>Please provide <strong>open</strong> links that <strong>DO NOT</strong> expire.</li>
                      </ul>
                  </p>
                  <img src={formatVideoImage} alt="Format Music Video" className="img-fluid mb-3" />
                  <Input type="url" name="videoDownloadLink" id="videoDownloadLink" placeholder="Enter DSP Video Download Link" value={formData.videoDownloadLink} onChange={handleChange} required />
              </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="timecodeCover">Timecode for Cover</Label>
                  <p className="text-muted">
                      <strong>Please note:</strong>
                      <ul className="text-dark h5 fw-medium">
                      <li>At what second would you like the video cover photo to be?</li>
                      <strong>Example: 00:00:00:00 / Hours, minutes, seconds and frames</strong> 
                  </ul>
                  </p>
                  <Input type="text" name="timecodeCover" id="timecodeCover" placeholder="Enter Timecode for Cover" value={formData.timecodeCover} onChange={handleChange} required />
              </FormGroup>
       
        <Button color="primary" type="submit">Submit</Button>
      </Form>
    </Card>
  );
}

function BothForms({ formData, setFormData, handleChange, addArtistField, removeArtistField }) {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 30 }, (_, i) => currentYear - i);
  return (
    <Card className="shadow-card p-4 mt-4">
      <h2 className="text-center"><FaYoutube className="me-2 mt--1" /> YouTube Claim + Music Video for DSP <FaFilm className="me-2 mt--1" /></h2>
      <hr className="mt-3"></hr>
      <Form>
              <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="videoTitle">Video Title <span className="text-danger">*</span></Label>
                  <p className="text-muted h5 fw-medium">Make sure it is written the same as the Project release.</p>
                  <Input type="text" name="videoTitle" id="videoTitle" placeholder="Enter Video Title" value={formData.videoTitle} onChange={handleChange} required />
              </FormGroup>

              <FormGroup className="mb-4">
          <Label className="font-weight-bold" for="artistName">
            Name of the artist(s) <span className="text-danger">*</span>
          </Label>
          {formData.artistNames.map((artist, index) => (
            <div key={index} className="d-flex mb-2">
              <Input
                type="text"
                name="artistNames"
                placeholder="Enter Artist(s) Name"
                value={artist}
                onChange={(e) => handleChange(e, index)}
                required
              />
              {index > 0 && (
                <Button color="danger" className="ms-2" onClick={() => removeArtistField(index)}>
                  &times;
                </Button>
              )}
            </div>
          ))}
          <Button color="primary" className="mt-2" onClick={addArtistField}>
            + Add Artist
          </Button>
        </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold">Release Date <span className="text-danger">*</span></Label>
                  <p className="text-muted h5 fw-medium">Day, Month, Year</p>
                  <ReactDatetime inputProps={{ placeholder: "Select Release Date" }} timeFormat={false} value={formData.releaseDate} onChange={(date) => setFormData({ ...formData, releaseDate: date })} />
              </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="recordLabel">Record Label</Label>
                  <Input type="text" name="recordLabel" id="recordLabel" placeholder="Enter Record Label" value={formData.recordLabel} readOnly/>
              </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="genre">Genre <span className="text-danger">*</span></Label>
                  <Input type="text" name="genre" id="genre" placeholder="Enter Genre" value={formData.genre} onChange={handleChange} required />
              </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold">
                  Is this video marked as Explicit? <span className="text-danger">*</span>
                  </Label>
                  <div className="d-flex align-items-center">
                  <div className="form-check mr-3">
                    <Input
                      type="radio"
                      name="explicit"
                      value="No"
                      id="explicitNo"
                      onChange={handleChange}
                      className="form-check-input"
                    />
                    <Label for="explicitNo" className="form-check-label ms-2">No</Label>
                  </div>
                  <div className="form-check ms-5"> {/* Increased margin here */}
                    <Input
                      type="radio"
                      name="explicit"
                      value="Yes"
                      id="explicitYes"
                      onChange={handleChange}
                      className="form-check-input"
                    />
                    <Label for="explicitYes" className="form-check-label ms-2">Yes</Label>
                  </div>
                  </div>
                  </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="videoLength">Video Length <span className="text-danger">*</span></Label>
                  <p className="text-muted h5 fw-medium">Example: 00:00:00</p>
                  <Input type="text" name="videoLength" id="videoLength" placeholder="Enter Video Length (e.g., 3:45)" value={formData.videoLength} onChange={handleChange} required />
              </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold">Copyright Disclaimer</Label>
                  <p className="text-muted h5 fw-medium">Year of production.</p>
                  <div className="d-flex align-items-center">
                      <Input type="select" name="copyrightYear" value={formData.copyrightYear} onChange={handleChange} style={{ maxWidth: "100px", marginRight: "10px" }} >
                          {years.map(year => (
                              <option key={year} value={year}>{year}</option>
                          ))}
                      </Input>
                      <Input type="text" value="Woss Music" readOnly style={{ backgroundColor: "#f8f9fa", width: "150px" }}/>
                  </div>
              </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="audioISRC">Audio ISRC <span className="text-danger">*</span></Label>
                  <p className="text-muted h5 fw-medium"><strong>NOTE:</strong> ISRCs are different from UPC codes.</p>
                  <Input type="text" name="audioISRC" id="audioISRC" placeholder="Enter Audio ISRC" value={formData.audioISRC} onChange={handleChange} required />
              </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="youtubeLink">YouTube Video Link <span className="text-danger">*</span></Label>
                  <p className="text-muted">
                      <strong>Please note:</strong>
                      <ul className="text-dark h5 fw-medium">
                          <li>Deliver the link marked as <strong>UNLISTED/HIDDEN</strong>.</li>
                          <li>Yes, it has already been published, just provide the <strong>public link</strong>.</li>
                      </ul>
                  </p>
                  <img src={unlistedVideoImage} alt="Hidden or Public Music Video" className="img-fluid mb-3" />
                  <Input type="url" name="youtubeLink" id="youtubeLink" placeholder="Enter YouTube Link" value={formData.youtubeLink} onChange={handleChange} required />
              </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="timecodeCover">Timecode for Cover</Label>
                  <p className="text-muted">
                      <strong>Please note:</strong>
                      <ul className="text-dark h5 fw-medium">
                      <li>At what second would you like the video cover photo to be?</li>
                      <strong>Example: 00:00:00:00 / Hours, minutes, seconds and frames</strong> 
                  </ul>
                  </p>
                  <Input type="text" name="timecodeCover" id="timecodeCover" placeholder="Enter Timecode for Cover" value={formData.timecodeCover} onChange={handleChange} required />
              </FormGroup>

              <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="videoDownloadLink">Music Video Download Link for DSPs <span className="text-danger">*</span></Label>
                  <p className="text-muted">
                      <strong>Please note:</strong>
                      <ul className="text-dark h5 fw-medium">
                          <li>1. <strong>Delivery</strong> the video on platforms such as: <strong>Dropbox, BOX or Google Drive (OPEN).</strong></li>
                          <li>2. The video format must be: <strong>Apple ProRes 422 HQ // .MOV // Stereo Audio // Maximum Size: 3840 x 2160 // FPS: 23.976 fps, 25 fps or 29.97 fps.</strong></li>
                          <li>3. The file can weigh more than 3GB, for this reason <strong>we recommend point 1.</strong></li>
                          <br></br>
                          <li>Please provide <strong>open</strong> links that <strong>DO NOT</strong> expire.</li>
                      </ul>
                  </p>
                  <img src={formatVideoImage} alt="Format Music Video" className="img-fluid mb-3" />
                  <Input type="url" name="videoDownloadLink" id="videoDownloadLink" placeholder="Enter DSP Video Download Link" value={formData.videoDownloadLink} onChange={handleChange} required />
              </FormGroup>

        <Button color="primary" type="submit">Submit</Button>
      </Form>
    </Card>
  );
}

export default NewMusicVideo;
