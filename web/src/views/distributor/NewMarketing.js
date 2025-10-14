import React, { useState } from "react";
import 'assets/css/argon-dashboard-pro-react.css';

// reactstrap components
import {
    Card,
    Container,
    Row,
    Col,
    Form,
    FormGroup,
    Input,
    Button,
    Progress
} from "reactstrap";
import NewMarketingHeader from "components/Headers/NewMarketingHeader.js";
import MarketingDoandDont from "assets/img/form-images/marketingdoanddont.jpg";

function NewMarketing() {
    const [formData, setFormData] = useState({
        artistName: "",
        artistBio: "",
        photoLink: "",
        linkDSP: ""
    });

    const [step, setStep] = useState(1);

    const handleNext = () => {
        if (step < 10) setStep(step + 1);
    };

    const handlePrev = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log("Form Data Submitted:", formData);
        alert("Form Submitted Successfully!");
    };

    return (
        <>
            <NewMarketingHeader />
            <Container className="mt--6" fluid>
                {/* Step Indicator */}
                <Row className="justify-content-center">
                    <Col md="8">
                        <h2 className="text-center">Step {step} of 10</h2>
                        <Card className="shadow-card p-4 bg-dark" style={{ borderRadius: "50px" }}>
                            <Progress className="mb-0" value={(step / 10) * 100} />
                        </Card>
                    </Col>
                </Row>

                {/* Wrap Everything in a Form */}
                <Form onSubmit={handleSubmit}>
                    {/* Step 1: Artist Name */}
                    {step === 1 && (
                        <Row className="justify-content-center">
                            <Col md="8">
                                <Card className="shadow-card p-4">
                                    <h2 className="text-center mb-4">Name of artist(s)</h2>
                                    <FormGroup>
                                        <Input type="text" name="artistName" value={formData.artistName} onChange={handleChange} placeholder="Enter Artist(s) Name" required />
                                    </FormGroup>
                                </Card>
                            </Col>
                        </Row>
                    )}

                    {/* Step 2: Artist Biography */}
                    {step === 2 && (
                        <Row className="justify-content-center">
                            <Col md="8">
                                <Card className="shadow-card p-4">
                                    <h2 className="text-center mb-4">Artist(s) Biography</h2>
                                    <p className="h4 text-muted">This is optional, but please note that it is important for us to have this information in our communication with the DSPs.</p>
                                    <p className="h5 mt-4 mb-4 text-black"><strong>*Only 1 paragraph. No more than 500 characters*</strong></p>
                                    <FormGroup>
                                        <Input type="textarea" name="artistBio" value={formData.artistBio} onChange={handleChange} maxLength="500" placeholder="Enter a resume for each artist(s)" />
                                    </FormGroup>
                                </Card>
                            </Col>
                        </Row>
                    )}

                    {/* Step 3: Photo Links */}
                    {step === 3 && (
                        <Row className="justify-content-center">
                            <Col md="8">
                                <Card className="shadow-card p-4">
                                    <h2 className="text-center mb-4">Downloadable link with photos</h2>
                                    <img src={MarketingDoandDont} alt="Format Music Video" className="img-fluid mb-3" />
                                    <Input type="text" name="photoLink" value={formData.photoLink} onChange={handleChange} placeholder="Provide photographies link" required />
                                </Card>
                            </Col>
                        </Row>
                    )}

                    {/* Step 4: Links to DSPs */}
                    {step === 4 && (
                        <Row className="justify-content-center">
                            <Col md="8">
                                <Card className="shadow-card p-4">
                                    <h2 className="text-center mb-4">Links to DSPs</h2>
                                    <FormGroup>
                                        <Input type="textarea" name="linkDSP" value={formData.linkDSP} onChange={handleChange} maxLength="500" placeholder="Provide DSP link for each artist(s)" />
                                    </FormGroup>
                                </Card>
                            </Col>
                        </Row>
                    )}

                    {/* Steps 5 to 9: Empty Placeholder */}
                    {step >= 5 && step <= 9 && (
                        <Row className="justify-content-center">
                            <Col md="8">
                                <Card className="shadow-card p-4 text-center">
                                    <h2>Step {step} (No Information)</h2>
                                </Card>
                            </Col>
                        </Row>
                    )}

                    {/* Step 10: Final Step with Submit Button */}
                    {step === 10 && (
                        <Row className="justify-content-center">
                            <Col md="8">
                                <Card className="shadow-card p-4 text-center">
                                    <h2>Final Step - Review & Submit</h2>
                                    <p>Please review all the information before submitting.</p>
                                    <Button color="success" type="submit">
                                        Submit Form
                                    </Button>
                                </Card>
                            </Col>
                        </Row>
                    )}

                    {/* Navigation Buttons */}
                    <Row className="justify-content-center mb-4">
                        <Col md="8" className="d-flex justify-content-between">
                            <Button color="primary" onClick={handlePrev} disabled={step === 1}>
                                <i className="fa fa-arrow-left"></i> Previous
                            </Button>
                            {step < 10 ? (
                                <Button color="primary" onClick={handleNext}>
                                    Next <i className="fa fa-arrow-right"></i>
                                </Button>
                            ) : null}
                        </Col>
                    </Row>
                </Form>
            </Container>
        </>
    );
}

export default NewMarketing;
