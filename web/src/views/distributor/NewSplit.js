import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card, Container, Row, Col, Form, FormGroup, Label, Input,
  InputGroup, InputGroupAddon, InputGroupText, Button
} from "reactstrap";
import NewSplitHeader from "components/Headers/NewSplitHeader.js";
import CustomSelect from "components/Custom/CustomSelect";
import { roleOptions } from "components/Custom/splitData.js";

function NewSplit() {
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    role: "",
    songTitle: "",
    percentage: ""
  });

  const [trackOptions, setTrackOptions] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [fadeOut, setFadeOut] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTracks = async () => {
      const token = localStorage.getItem("woss_token");

      if (!token) {
        console.warn("🚫 No auth token found. Redirecting to login...");
        return;
      }

      try {
        const res = await fetch("http://localhost:4000/api/splits/my-tracks", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          console.error(`Server responded with ${res.status}`);
          return;
        }

        const data = await res.json();

        if (data.success && Array.isArray(data.tracks)) {
          const options = data.tracks.map((t) => ({
            value: t.id,
            label: t.track_title,
          }));
          setTrackOptions(options);
        } else {
          console.error("Track load failed:", data.message);
        }
      } catch (err) {
        console.error("Track fetch error:", err);
      }
    };

    fetchTracks();
  }, []);

  const triggerPopup = (message) => {
    setPopupMessage(message);
    setFadeOut(false);
    setShowPopup(true);
    setTimeout(() => setFadeOut(true), 1500);
    setTimeout(() => setShowPopup(false), 3000);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "percentage") {
      let numeric = value.replace(/[^0-9]/g, "");
      numeric = numeric === "" ? "" : Math.min(parseInt(numeric, 10), 100).toString();
      setFormData({ ...formData, [name]: numeric });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleBlur = () => {
    setFormData(prev => ({
      ...prev,
      percentage: prev.percentage ? prev.percentage + "%" : ""
    }));
  };

  const handleFocus = () => {
    setFormData(prev => ({
      ...prev,
      percentage: prev.percentage.replace("%", "")
    }));
  };

  const handleSelectChange = (selectedOption, action) => {
    setFormData({
      ...formData,
      [action.name]: selectedOption ? selectedOption.value : ""
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const { email, name, role, songTitle, percentage } = formData;

    if (!email || !name || !role || !songTitle || !percentage) {
      triggerPopup("Please fill out all fields before sending.");
      return;
    }

    setShowConfirmModal(true);
  };

  const confirmSubmit = async () => {
    setShowConfirmModal(false);

    try {
      const token = localStorage.getItem("woss_token");
      const res = await fetch("http://localhost:4000/api/splits/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          invitee_email: formData.email,
          track_id: formData.songTitle,
          percentage: parseFloat(formData.percentage.replace("%", "")),
          name: formData.name,
          role: formData.role,
        }),
      });

      const data = await res.json();
      if (data.success) {
        navigate("/app/portal/splits", {
          state: { successMessage: "Split sent successfully!" },
        });
      } else {
        triggerPopup(data.message || "Failed to send split.");
      }
    } catch (err) {
      console.error("Split creation failed:", err);
      triggerPopup("Error sending split.");
    }
  };

  return (
    <>
      {showPopup && (
        <div className={`danger-popup ${fadeOut ? "fade-out" : ""}`}>
          {popupMessage}
        </div>
      )}

      {showConfirmModal && (
        <>
          <div className="modal-overlay" />
          <div className="confirm-modal">
            <h4>Are you sure you want to create this split?</h4>
            <div className="mt-4">
              <Button color="dark" className="mr-3" onClick={() => setShowConfirmModal(false)}>
                Cancel
              </Button>
              <Button color="primary" className="text-white" onClick={confirmSubmit}>
                Yes
              </Button>
            </div>
          </div>
        </>
      )}

      <NewSplitHeader />
      <Container className="mt--6" fluid>
        <Row className="justify-content-center">
          <Col md="6">
            <Card className="shadow-card p-4">
              <h2 className="text-center mb-4">New Split</h2>
              <hr className="mt--1" />
              <Form onSubmit={handleSubmit}>
                <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="email">Email</Label>
                  <InputGroup>
                    <InputGroupAddon addonType="prepend">
                      <InputGroupText><i className="fas fa-envelope" /></InputGroupText>
                    </InputGroupAddon>
                    <Input
                      type="email"
                      name="email"
                      id="email"
                      placeholder="Enter Email"
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </InputGroup>
                </FormGroup>

                <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="name">Name</Label>
                  <InputGroup>
                    <InputGroupAddon addonType="prepend">
                      <InputGroupText><i className="fas fa-user" /></InputGroupText>
                    </InputGroupAddon>
                    <Input
                      type="text"
                      name="name"
                      id="name"
                      placeholder="Enter Name"
                      value={formData.name}
                      onChange={handleChange}
                    />
                  </InputGroup>
                </FormGroup>

                <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="role">Role</Label>
                  <CustomSelect
                    name="role"
                    options={roleOptions}
                    value={roleOptions.find(option => option.value === formData.role) || null}
                    onChange={(selectedOption) => handleSelectChange(selectedOption, { name: "role" })}
                    className="form-control"
                  />
                </FormGroup>

                <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="songTitle">Select Song</Label>
                  <CustomSelect
                    name="songTitle"
                    options={trackOptions}
                    value={trackOptions.find(option => option.value === formData.songTitle) || null}
                    onChange={(selectedOption) => handleSelectChange(selectedOption, { name: "songTitle" })}
                    className="form-control"
                  />
                </FormGroup>

                <FormGroup className="mb-4">
                  <Label className="font-weight-bold" for="percentage">Percentage</Label>
                  <InputGroup>
                    <InputGroupAddon addonType="prepend">
                      <InputGroupText><i className="fas fa-percentage" /></InputGroupText>
                    </InputGroupAddon>
                    <Input
                      type="text"
                      name="percentage"
                      id="percentage"
                      placeholder="Enter Percentage"
                      value={formData.percentage}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      onFocus={handleFocus}
                      maxLength={3}
                    />
                  </InputGroup>
                </FormGroup>

                <Button color="primary" block type="submit">Submit</Button>
              </Form>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
}

export default NewSplit;
