import React, { useState } from "react";
import 'assets/css/argon-dashboard-pro-react.css';
import {
    Card, CardHeader, CardBody, Form, FormGroup, Input, Label, Button, Container, Row, Col, Modal, ModalHeader, ModalBody
} from "reactstrap";
import { FaTrash } from "react-icons/fa";
import NewWorkHeader from "components/Headers/NewWorkHeader.js";

function NewWork() {
    const [formData, setFormData] = useState({
        songTitle: "",
        alternativeTitle: "",
        writerName: "",
        writerRole: "",
        writerShare: "", // No default value
        publisherShare: "", // No default value
        publisherTerritory: "WORLD",
    });

    const [modal, setModal] = useState(false);
    const [error, setError] = useState("");

    const toggleModal = () => setModal(!modal);

    const handleChange = (e) => {
        let { name, value } = e.target;
        
        value = value.replace(/\D/g, "");

        if (value.startsWith("0")) {
            value = value.replace(/^0+/, "");
        }

        if (value !== "" && parseInt(value) > 50) {
            value = "50";
        }

        if (value.length > 2) {
            value = value.slice(0, 2);
        }

        let newFormData = { ...formData, [name]: value };
        let writerShare = parseInt(newFormData.writerShare) || 0;
        let publisherShare = parseInt(newFormData.publisherShare) || 0;

        if (writerShare + publisherShare > 100) {
            setError("Total Writer and Publisher shares cannot exceed 100%");
            return;
        } else {
            setError("");
        }

        setFormData(newFormData);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log("Form Submitted:", formData);
    };

    const getShareStyle = (share) => {
        if (!share || parseInt(share) === 0) {
            return { fontWeight: "bold", color: "black", fontSize: "1.5rem" };
        } else if (parseInt(share) === 50) {
            return { fontWeight: "bold", color: "#80D462", fontSize: "1.5rem" };
        } else {
            return { fontWeight: "bold", color: "#cd3533", fontSize: "1.5rem" };
        }
    };    

    const [writers, setWriters] = useState([{ id: Date.now(), isProtected: true, writerShare: "", publisherShare: "", publisherName: "Woss Music Publishing Group", publisherIpi: "1281050389", hasNoPublisher: false }]);


    const addWriter = () => {
        setWriters([...writers, { id: Date.now(), isProtected: false, writerShare: "", publisherShare: "", publisherName: "", publisherIpi: "" }]);
    };

    const removeWriter = (id) => {
        setWriters(writers.filter(writer => writer.id !== id));
    };

    const handleWriterChange = (id, field, value) => {
        let newValue = value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 2); // Remove leading zeros and allow max two digits
        if (newValue === "") newValue = "0";
        if (parseInt(newValue) > 50) newValue = "50";
        setWriters(writers.map(writer => 
            writer.id === id ? { ...writer, [field]: newValue } : writer
        ));
    };

    const handlePublisherChange = (id, field, value) => {
        setWriters(writers.map(writer => 
            writer.id === id ? { ...writer, [field]: value } : writer
        ));
    };

    const totalWriterShare = writers.reduce((acc, writer) => acc + (parseInt(writer.writerShare) || 0), 0);
    const totalPublisherShare = writers.reduce((acc, writer) => acc + (parseInt(writer.publisherShare) || 0), 0); 
    
    

    return (
        <>
            <NewWorkHeader />
            <Container className="mt--6" fluid>
                <Row>
                    <Col xs="12">
                        {/* Work Title Card */}
                        <Card className="shadow-card mb-4">
                            <CardHeader className="border-0">
                                <h3 className="mb-0 text-white">
                                    <i className="fa fa-music"></i> <b>Work Title</b>
                                </h3>
                            </CardHeader>
                            <CardBody>
                                <Form>
                                    <FormGroup>
                                        <Label for="songTitle"><b>Work Title *</b></Label>
                                        <Input type="text" name="songTitle" id="songTitle" placeholder="Enter Work Title" value={formData.songTitle} onChange={handleChange} required />
                                    </FormGroup>
                                </Form>
                            </CardBody>
                        </Card>
                        {/* Writers & Publishers Card */}
                        <Card className="shadow-card">
                            <CardHeader className="border-0">
                                <h3 className="mb-0 text-white">
                                    <i className="fa fa-users"></i> <b>Writers & Publishers</b>
                                </h3>
                            </CardHeader>      
                            <CardBody>
                            <p className="font-weight-bold text-black">Remember that Writer(s) shares must total 50%. Publisher(s) shares must also total 50%.</p>
                                    {error && <p className="text-danger"><b>{error}</b></p>}
                                    <Row className="d-flex flex-column flex-md-row justify-content-between">
                                    <Col md="6" className="d-flex flex-column align-items-center align-items-md-start">
                                    <p className="fw-medium text-black">Writer Share: <span style={getShareStyle(totalWriterShare)}>{totalWriterShare}%</span> (must total 50%)</p>
                                    </Col>
                                    <Col md="6" className="d-flex flex-column align-items-center align-items-md-end">
                                        <p className="fw-medium text-black">Publisher Share: <span style={{ fontWeight: "bold", color: totalPublisherShare === 50 ? "#80D462" : totalPublisherShare === 0 ? "black" : "#cd3533", fontSize: "1.5rem" }}>{totalPublisherShare}%</span> (must total 50%)</p>
                                    </Col>
                                </Row>
                                <hr className="mt-0"></hr>
                                <Form  onSubmit={handleSubmit}>                
                                {totalWriterShare > 50 || totalPublisherShare > 50 ? (
                                    <p className="text-danger"><b>Total Writer and Publisher shares cannot exceed 50%</b></p>
                                ) : null}
                                {writers.map((writer, index) => (
                            <Card key={writer.id} className="bg-primary border-dark shadow-card w-100 mt-3">
                            <CardBody>
                              <Row className="d-flex flex-column flex-md-row justify-content-between">
                                
                                {/* Writer Section (Full Width on Mobile) */}
                                <Col xs="12" md="6" className="mb-3">
                                    <FormGroup>
                                        <Label className="text-white" for="writerName"><b>Writer Name *</b></Label>
                                        <Input type="text" name="writerName" id="writerName" placeholder="Enter Name" required />
                                    </FormGroup>
                                    <FormGroup>
                                        <Label className="text-white" for="writerIpi"><b>Writer IPI *</b></Label>
                                        <Input type="text" name="writerIpi" id="writerIpi" placeholder="Enter IPI Number" required />
                                    </FormGroup>
                                    <FormGroup>
                                        <Label className="text-white" for="writerRole"><b>Role *</b></Label>
                                        <Input type="select" name="writerRole" id="writerRole" onChange={handleChange}>
                                            <option value="">Select Role</option>
                                            <option value="Composer/Author">Composer/Author</option>
                                            <option value="Composer">Composer</option>
                                            <option value="Author">Author</option>
                                            <option value="Arranger">Arranger</option>
                                            <option value="Adaptor">Adaptor</option>
                                            <option value="Translator">Translator</option>
                                        </Input>
                                    </FormGroup>
                                    <FormGroup>
                                        <Label className="text-white" for="writerShare"><b>Writer Share % *</b></Label>
                                        <Input 
                                            type="text" 
                                            name="writerShare" 
                                            id="writerShare" 
                                            placeholder="Enter Writer Share %" 
                                            value={writer.writerShare} 
                                            onChange={(e) => handleWriterChange(writer.id, 'writerShare', e.target.value)} 
                                            required
                                        />
                                        {!writer.isProtected && (
                                                <Row className="mt-3 mb--4">
                                                    <Col className="d-flex justify-content-end align-items-center">
                                                        <Button color="link" className="p-0" onClick={() => removeWriter(writer.id)}>
                                                            <FaTrash style={{ color: "white", fontSize: "1.5rem" }} />
                                                        </Button>
                                                    </Col>
                                                </Row>
                                            )}
                                    </FormGroup>
                                </Col>

                        {/* Divider Line - Visible Only in Mobile */}
                            <Col xs="12" className="d-md-none">
                                <hr className="border-white mb-4 my-2"/>
                            </Col>

                       {/* Publisher Section (Full Width on Mobile) */}
                       <Col xs="12" md="6" >
                       <FormGroup>
                                <Label className="text-white" for="publisherName"><b>Publisher Name</b></Label>
                                <Input 
                                    type="text" 
                                    name="publisherName" 
                                    id="publisherName" 
                                    value={writer.publisherName} 
                                    onChange={(e) => handlePublisherChange(writer.id, 'publisherName', e.target.value)} 
                                    readOnly={index === 0} 
                                    placeholder={index === 0 ? "" : "Enter Publisher Name"}
                                />
                                </FormGroup>
                                <FormGroup>
                                <Label className="text-white" for="publisherIpi"><b>Publisher IPI</b></Label>
                                <Input 
                                    type="text" 
                                    name="publisherIpi" 
                                    id="publisherIpi" 
                                    value={writer.publisherIpi} 
                                    onChange={(e) => handlePublisherChange(writer.id, 'publisherIpi', e.target.value)} 
                                    readOnly={index === 0} 
                                    placeholder={index === 0 ? "" : "Enter Publisher IPI"}
                                />
                                </FormGroup>
                                <FormGroup>
                                <Label className="text-white" for="publisherTerritory"><b>Territory</b></Label>
                                <Input type="select" name="publisherTerritory" id="publisherTerritory" value={formData.publisherTerritory} onChange={handleChange}>
                                    <option value="WORLD">WORLD</option>
                                </Input>
                                </FormGroup>
                                <FormGroup>
                                <Label className="text-white" for="publisherShare"><b>Publisher Share %</b></Label>
                                <Input 
                                    type="text" 
                                    name="publisherShare" 
                                    id="publisherShare" 
                                    placeholder="Enter Publisher Share %" 
                                    value={writer.publisherShare} 
                                    readOnly={writer.hasNoPublisher} 

                                    onChange={(e) => handleWriterChange(writer.id, 'publisherShare', e.target.value)} 
                                    required
                                />
                                </FormGroup>
                                
                                </Col>    
                                </Row>
                                </CardBody>
                                 </Card>
                                ))}
                                <Button onClick={addWriter} color="primary" className="mb-3">+ Add Write</Button>
                                </Form>
                            </CardBody>
                        </Card>
                        
                        {/* Footer Section */}
                <div className="mt-4 flex flex-col items-center md:items-start text-center md:text-left">
                   
                    <p>
                            By clicking "Submit", I confirm that the work registration information I am submitting to ASCAP is accurate and agree that my registration of such work is subject to and complies in all respects with the 
                            <a
                            href
                            role="button"
                            onClick={toggleModal}
                            className="text-primary"
                            style={{ cursor: "pointer", textDecoration: "underline" }}
                            >
                            <br />
                            <b>Works Registration Terms and Conditions</b>
                            </a>
                    </p>

                    <div className="flex flex-col items-center md:items-start mt-2 space-y-2 md:flex-row md:space-y-0 md:space-x-2">
                        <Button color="primary" outline>CANCEL</Button>
                        <Button color="primary">SUBMIT</Button>
                    </div>
                </div>

                    </Col>
                </Row>
            </Container>
            {/* Terms and Conditions Modal */}
            <Modal isOpen={modal} toggle={toggleModal} size="lg">
             <ModalHeader toggle={toggleModal}><h2><b><u>Works Terms and Conditions</u></b></h2></ModalHeader>
                <ModalBody>
                <p className="text-black mt--4">Without limiting the generality of the Terms of Use Agreement to which you agreed upon your access to and use of this website, please be advised that the following Additional Terms ("Work Registration Terms and Conditions") specifically apply to the registration of musical works with ASCAP through Member Access. Capitalized terms used but not otherwise defined herein shall have the meanings ascribed to such terms in the Terms of Use Agreement.
                <br></br><br></br>
                1. <b><u>Warranties and Representations.</u></b> I represent, warrant and covenant that, with respect to any and all musical works that I register with ASCAP ("Titles"), either (a) I am a member of ASCAP and (i) the writer, or one of the writers, of such Titles, (ii) the publisher, or one of the publishers, of such Titles, or (iii) the duly appointed successor to a Writer Member, or (b) I am duly authorized by an ASCAP member to register such Titles with ASCAP on behalf of such member using means authorized by such member, and to bind such member to all of the terms and conditions hereof (such members, and any such authorized person (as applicable), are all hereinafter referred to as "Member"). Member further represents, warrants and covenants that (y) Member has the necessary licenses, rights, authorization, consents, and permissions to register the Titles with ASCAP, and (z) all of the information with respect to such Titles, including, without limitation, information relating to the writer(s) and the publisher(s) of such Titles, furnished by Member is true and accurate. Member understands and acknowledges that ASCAP may share such information with third parties (as further described in Section 5) and that ASCAP and such third parties may be distributing royalties to Member and/or third parties in reliance upon such information and the representations and warranties contained herein. Member further acknowledges that any misrepresentations as to any of the information provided with respect to the Titles to be registered, the authorization of any non-Member to register such Titles, the identity of the writer(s) and publishers(s), and their respective interests in such Titles, or any other erroneous, false, discrepant or misleading statements ("Misrepresentations") may be cause for ASCAP, in its sole discretion, to take action against Member pursuant to Section 2 below.
                <br></br><br></br>
                2. <b><u>Misrepresentations.</u></b> Member understands and acknowledges that, if ASCAP has good cause to believe that Member has made any Misrepresentations in respect of any Titles that Member registers, then ASCAP may immediately, without notice to Member, take appropriate action including, without limitation, suspension of payment of any and all performance royalties to Member; suspension of Member’s ability to register additional Titles; adjustment of Member’s ASCAP account to recoup or redistribute any royalties that were improperly distributed as a result of any such Misrepresentation; application of an administrative charge to Member’s ASCAP account for the additional research and time expended by ASCAP to investigate any such Misrepresentation; removal of Titles from any and all ASCAP repertory and distribution databases; and demand reimbursement of any amounts paid in error by ASCAP as a result of any Misrepresentation.
                <br></br><br></br>
                3. <b><u>Additional Information.</u></b> ASCAP may contact Member with regard to any suspected Misrepresentation, and Member will have ten (10) days from the date of such correspondence (or such shorter period of time as may be set forth in such correspondence) within which to address and correct any Misrepresentations that ASCAP believes Member may have made and to request reconsideration of the steps ASCAP is preparing to take (each, a "Member Letter"). The Member Letter should be accompanied by supporting documentation sufficient to demonstrate that Member has the requisite authority to register the Titles with ASCAP and to verify the information provided by Member in connection therewith, which documentation may include, without limitation, a U.S. Copyright Registration, agreements with co-writers and/or producers (so-called "split sheets"), a copy of the published lyrics and sheet music for such Titles, and/or a sound recording. The Member Letter and its attached documentation should contain all information supporting Member’s contention that there has been no Misrepresentation to ASCAP in connection with the registration of the Titles. Member understands and acknowledges that ASCAP reserves the right, after reviewing the Member Letter, to determine that the statements made by Member therein may qualify as a claim against another person’s work and, in such an instance, the matter will be addressed pursuant to Section 2.8 of the Compendium of ASCAP Rules, Regulations and Policies Supplemental to the Articles of Association. Member understands and acknowledges that ASCAP may, in its sole discretion, at any time, issue a final and non-appealable decision concerning (i) the proper owner(s) of the Titles in question and/or any other matters related to the suspected Misrepresentation and (ii) what remedies (if any) ASCAP may seek, in its sole discretion.
                <br></br><br></br>
                4. <b><u>Indemnification.</u></b> Member agrees to indemnify, hold harmless, release and, at ASCAP’s request, defend ASCAP and any foreign performing rights organization with which ASCAP is affiliated and each of their respective officers, directors, members, agents and employees from and against any and all suits, actions, legal or administrative proceedings, claims, demands, damages, penalties, fines, costs and expenses of whatsoever kind of character (including, but not limited to, legal fees and expenses and amounts paid in error by ASCAP or any foreign performing rights organization) (each, a "Misrepresentation Claim"), arising out of any Misrepresentation or other negligent or willful actions in relation to Member’s registration of Titles with ASCAP. Notwithstanding the foregoing, ASCAP shall have the option to settle or defend any Misrepresentation Claim through counsel of ASCAP’s sole choice and at its own expense. Member will reasonably cooperate in the handling of the Misrepresentation Claim and make available to ASCAP any defenses to such Misrepresentation Claim available to Member.
                <br></br><br></br>
                5. <b><u>Sharing of Information with Third Parties.</u></b> Member acknowledges and agrees that any information provided by Member regarding Titles may be disclosed to ASCAP’s affiliates, service providers, suppliers, licensees, members, other performing rights organizations and collective rights management organizations and their members, and to other third parties in connection with the operation of ASCAP’s business, including, without limitation, for purposes of facilitating the identification of works and the calculation, administration and distribution of royalties or any other payments that accrue with respect to the public performance of musical works.</p>
             </ModalBody>
            </Modal>
        </>
    );
}

export default NewWork;