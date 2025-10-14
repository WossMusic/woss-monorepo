import React, { useState, useEffect } from "react";
import classnames from "classnames";
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Form,
  FormGroup,
  Input,
  InputGroupAddon,
  InputGroupText,
  InputGroup,
  Container,
  Row,
  Badge,
  Col,
} from "reactstrap";

import BankingHeader from "components/Headers/BankingHeader.js";
import AddBankAccount from "views/userconfig/AddBankAccount.js";

function Banking() {
  const [focusedInput, setFocusedInput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [fadeOut, setFadeOut] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bankInfo, setBankInfo] = useState(null);

  // ✅ Moved this function out of useEffect
  const fetchBankInfo = async () => {
    try {
      const res = await fetch("http://localhost:4000/api/bankaccounts/me", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("woss_token")}`,
        },
      });

      const result = await res.json();
      if (result.success) {
        setBankInfo(result.data);
      }
    } catch (error) {
      console.error("Failed to load bank info", error);
    }
  };

  // ✅ Called on mount
  useEffect(() => {
    fetchBankInfo();
  }, []);

  // ✅ Update the handler
  const handleSuccess = (message) => {
    setLoading(true);
    setPopupMessage(message);
    setShowPopup(true);
    setFadeOut(false);

    setTimeout(() => setFadeOut(true), 2000);
    setTimeout(() => setShowPopup(false), 3000);

    // ✅ Now we refresh the data
    fetchBankInfo();

    setTimeout(() => {
      setLoading(false);
    }, 1200);
  };

   const toggleModal = () => setIsModalOpen(!isModalOpen);


return (
    <>
      {showPopup && (
        <div className={`success-popup ${fadeOut ? "fade-out" : ""}`}>
          {popupMessage}
        </div>
      )}

 {loading && (
  <div className="loader-container">
    <div className="loader" />
    <p className="loader-text">Processing Method...</p>
  </div>
)}
 <BankingHeader
      onAddAccountClick={toggleModal}
      bankInfo={bankInfo}
    />
      <Container className="mt--6" fluid>
        <Row>
          <Col xl="12">
            <Card className="shadow-card">
         <CardHeader className="d-flex justify-content-between align-items-center">
            <h3 className="mb-0 text-white">Bank Information</h3>
            {bankInfo && bankInfo.status && (
              <Badge
                color={bankInfo.status === "Verified" ? "success" : "warning"}
                className="custom-status-badge"
              >
                {bankInfo.status}
              </Badge>
            )}
          </CardHeader>
          
                {!bankInfo && (
                  <div className="blur-overlay-message">
                    <h3 className="no-bank-text">No Method Added</h3>
                  </div>
                )}
              <CardBody className={!bankInfo ? "blurred-card-container" : ""}>
                <h6 className="heading-small text-muted mb-4">
                  Method Payment
                </h6>
                <Row>
                  {/* Wire Transfer Card */}
                  <Col md="6" sm="12">
                    <Card className="bg-white shadow-card mb-4">
                      <CardBody>
                        <Row className="justify-content-between align-items-center">
                          <div className="col">
                            <span className="ml-0 h2">
                              {bankInfo?.payment_method || "Wire Transfer"}
                            </span>
                          </div>            
                        </Row>

                      <Form className="form-primary mt-4" role="form">
                      <FormGroup>
                        <InputGroup
                          className={classnames("input-group-alternative mb-3", {
                            focused: focusedInput === "accountName",
                          })}
                        >
                          <InputGroupAddon addonType="prepend">
                            <InputGroupText>
                              <i className="ni ni-single-02" />
                            </InputGroupText>
                          </InputGroupAddon>
                          <Input
                            type="text"
                            name="accountName"
                            value={
                              bankInfo?.payment_method === "ACH Transfer" ||
                              bankInfo?.payment_method === "Wire Transfer" ||
                              bankInfo?.payment_method === "International Wire"
                                ? bankInfo?.account_name || bankInfo?.legal_name || ""
                                : ""
                            }
                            readOnly
                            onFocus={() => setFocusedInput("accountName")}
                            onBlur={() => setFocusedInput(null)}
                          />
                        </InputGroup>
                      </FormGroup>

                      <FormGroup>
                        <InputGroup
                          className={classnames("input-group-alternative mb-3", {
                            focused: focusedInput === "bankName",
                          })}
                        >
                          <InputGroupAddon addonType="prepend">
                            <InputGroupText>
                              <i className="fa fa-bank" />
                            </InputGroupText>
                          </InputGroupAddon>
                          <Input
                            type="text"
                            name="bankName"
                            value={
                              bankInfo?.payment_method === "ACH Transfer" ||
                              bankInfo?.payment_method === "Wire Transfer" ||
                              bankInfo?.payment_method === "International Wire"
                                ? bankInfo?.bank_name || ""
                                : ""
                            }
                            readOnly
                            onFocus={() => setFocusedInput("bankName")}
                            onBlur={() => setFocusedInput(null)}
                          />
                        </InputGroup>
                      </FormGroup>

                      <Row>
                        <Col xs="6">
                          <FormGroup>
                            <InputGroup
                              className={classnames("input-group-alternative mb-3", {
                                focused: focusedInput === "swiftCode",
                              })}
                            >
                              <InputGroupAddon addonType="prepend">
                                <InputGroupText>
                                  <i className="fa fa-hashtag" />
                                </InputGroupText>
                              </InputGroupAddon>
                              <Input
                                type="text"
                                name="swiftCode"
                                value={
                                  bankInfo?.payment_method === "ACH Transfer" ||
                                  bankInfo?.payment_method === "Wire Transfer"
                                    ? bankInfo?.routing_number || ""
                                    : bankInfo?.swift_code || ""
                                }
                                readOnly
                                onFocus={() => setFocusedInput("swiftCode")}
                                onBlur={() => setFocusedInput(null)}
                              />
                            </InputGroup>
                          </FormGroup>
                        </Col>

                        <Col xs="6">
                          <FormGroup>
                            <InputGroup
                              className={classnames("input-group-alternative", {
                                focused: focusedInput === "iban",
                              })}
                            >
                              <InputGroupAddon addonType="prepend">
                                <InputGroupText>
                                  <i className="fa fa-hashtag" />
                                </InputGroupText>
                              </InputGroupAddon>
                              <Input
                                type="text"
                                name="iban"
                                value={
                                  bankInfo?.payment_method === "ACH Transfer" ||
                                  bankInfo?.payment_method === "Wire Transfer"
                                    ? bankInfo?.account_number || ""
                                    : bankInfo?.iban || ""
                                }
                                readOnly
                                onFocus={() => setFocusedInput("iban")}
                                onBlur={() => setFocusedInput(null)}
                              />
                            </InputGroup>
                          </FormGroup>
                        </Col>
                      </Row>
                    </Form>
                      </CardBody>
                    </Card>
                  </Col>

                  {/* Method Info Card */}
                  <Col md="6" sm="12">
                    <Card className="bg-white shadow-card mb-4">
                      <CardBody>
                        <Row className="justify-content-between align-items-center">
                          <div className="col">
                            <span className="ml-0 h2">
                              Personal Information
                            </span>
                          </div>
                        </Row>       
                          <Row className="mt-3">
                           <Col md="12">
                            <FormGroup>
                              <div className="profile-selection d-flex gap-3 w-100 flex-wrap">
                                <Button
                                  type="button"
                                    className={`ownership-button flex-grow-1 d-flex align-items-center justify-content-center ${
                                    bankInfo?.is_third_party === 0 ? "selected" : ""
                                  }`}
                                >
                                  <span className="h4 font-weight-bold mb-0">Personal</span>
                                </Button>

                                <Button
                                  type="button"
                                    className={`ownership-button flex-grow-1 d-flex align-items-center justify-content-center ${
                                    bankInfo?.is_third_party === 1 ? "selected" : ""
                                  }`}
                                >
                                  <span className="h4 font-weight-bold mb-0">Third Party</span>
                                </Button>
                              </div>
                            </FormGroup>
                           </Col>
                          </Row>
                        <Form className="form-primary mt-3 mb-3" role="form">
                          <FormGroup>
                            <InputGroup className="input-group-alternative">
                              <InputGroupAddon addonType="prepend">
                                <InputGroupText className="bg-custom-icon">
                                  <i className="fa fa-user" />
                                </InputGroupText>
                              </InputGroupAddon>
                              <Input
                                value={bankInfo?.legal_name || ""}
                                name="legal_name"
                                readOnly
                              />
                            </InputGroup>
                          </FormGroup>
                            <FormGroup>
                          <div className="profile-selection d-flex mt-4 gap-3 w-100 flex-wrap">
                            <Button
                              type="button"
                                className={`ownership-button flex-grow-1 d-flex align-items-center justify-content-center ${
                                bankInfo?.profile_type === "Individual" ? "selected" : ""
                              }`}
                            >
                              <span className="h4 font-weight-bold mb-0">Individual</span>
                            </Button>

                            <Button
                              type="button"
                                className={`ownership-button flex-grow-1 d-flex align-items-center justify-content-center ${
                                bankInfo?.profile_type === "Company" ? "selected" : ""
                              }`}
                            >
                              <span className="h4 font-weight-bold mb-0">Company</span>
                            </Button>
                          </div>
                        </FormGroup>
                        </Form>
                      </CardBody>
                    </Card>
                  </Col>
                  
                   {/* Address Info Card */}
                  <Col md="12" sm="12">
                    <Card className="bg-white shadow-card mb-4">
                      <CardBody>
                        <Row className="justify-content-between align-items-center">
                          <div className="col">
                            <span className="ml-0 h2">
                              Other Information
                            </span>
                          </div>
                        </Row>

                        <Form className="form-primary mt-4" role="form">
                          <FormGroup>
                            <InputGroup className="input-group-alternative mb-3">
                              <InputGroupAddon addonType="prepend">
                                <InputGroupText className="bg-custom-icon">
                                  <i className="fa fa-location-arrow" />
                                </InputGroupText>
                              </InputGroupAddon>
                              <Input
                                value={bankInfo?.address || ""}
                                name="address"
                                readOnly
                              />
                            </InputGroup>
                          </FormGroup>

                          <FormGroup>
                            <InputGroup className="input-group-alternative mb-3">
                              <InputGroupAddon addonType="prepend">
                                <InputGroupText className="bg-custom-icon">
                                  <i className="fa fa-building" />
                                </InputGroupText>
                              </InputGroupAddon>
                              <Input
                                value={bankInfo?.city || ""}
                                name="city"
                                readOnly
                              />
                            </InputGroup>
                          </FormGroup>

                          <Row>
                            <Col md="4">
                              <FormGroup>
                                <InputGroup className="input-group-alternative mb-3">
                                  <InputGroupAddon addonType="prepend">
                                    <InputGroupText className="bg-custom-icon">
                                      <i className="fa fa-map-pin" />
                                    </InputGroupText>
                                  </InputGroupAddon>
                                  <Input
                                    value={bankInfo?.state || ""}
                                    name="state"
                                    readOnly
                                  />
                                </InputGroup>
                              </FormGroup>
                            </Col>
                            <Col md="4">
                              <FormGroup>
                                <InputGroup className="input-group-alternative mb-3">
                                  <InputGroupAddon addonType="prepend">
                                    <InputGroupText className="bg-custom-icon">
                                      <i className="fa fa-location" />
                                    </InputGroupText>
                                  </InputGroupAddon>
                                  <Input
                                    value={bankInfo?.zip || ""}
                                    name="zip"
                                    readOnly
                                  />
                                </InputGroup>
                              </FormGroup>
                            </Col>
                            <Col md="4">
                              <FormGroup>
                                <InputGroup className="input-group-alternative mb-3">
                                  <InputGroupAddon addonType="prepend">
                                    <InputGroupText className="bg-custom-icon">
                                      <i className="fa fa-globe" />
                                    </InputGroupText>
                                  </InputGroupAddon>
                                  <Input
                                    value={bankInfo?.country || ""}
                                    name="country"
                                    readOnly
                                  />
                                </InputGroup>
                              </FormGroup>
                            </Col>
                          </Row>      
                        </Form>
                      </CardBody>
                    </Card>
                  </Col>
                </Row>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>


    <AddBankAccount
      isOpen={isModalOpen}
      toggle={toggleModal}
      onSuccess={handleSuccess}
      existingData={bankInfo}
    />
    </>
  );
}

export default Banking;
