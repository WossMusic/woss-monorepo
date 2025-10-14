import React from "react";
import {
    Container,
    Row,
    Col
} from "reactstrap";

const Countries = () => {
    return (
        <>
            <Container fluid className="pb-5">
                {/* Centered Menu Bar with Proper Alignment */}
                <Row className="mb-4">
                    <Col xs="12">
                        <nav className="d-flex flex-wrap justify-content-center align-items-center font-weight-bold bg-dark p-2 rounded w-100 overflow-hidden">
                            <button className="mx-2 text-white menu-link">Statement Overview</button>
                            <button className="mx-2 text-white menu-link">Categories</button>
                            <button className="mx-2 text-white menu-link active">Countries</button>
                            <button className="mx-2 text-white menu-link">Tracks</button>
                            <button className="mx-2 text-white menu-link">Providers</button>
                            <button className="mx-2 text-white menu-link">Trends & Analyses</button>
                        </nav>
                    </Col>
                </Row>

                <style>
                    {`
                        .menu-link {
                            padding: 8px 12px;
                            font-size: 1rem;
                            display: inline-block;
                            border: none;
                            background: none;
                            cursor: pointer;
                            white-space: nowrap;
                        }
                        .menu-link:hover {
                            background-color: #56BCB6;
                            border-radius: 5px;
                        }
                        .menu-link.active {
                            background-color: #56BCB6;
                            border-radius: 5px;
                        }
                        nav {
                            display: flex;
                            justify-content: center;
                            gap: 10px;
                            flex-wrap: wrap;
                            max-width: 100%;
                        }
                    `}
                </style>

                {/* Page Content */}
                <Row className="d-flex justify-content-center">
                    <Col xs="12" md="8">
                        <h2 className="text-center font-weight-bold">Countries Management</h2>
                        <p className="text-center">Add new country information below.</p>
                        
                        {/* Country Input Section */}
                        <Row className="d-flex justify-content-center">
                            <Col xs="12" md="6">
                                <input
                                    type="text"
                                    className="form-control mb-3"
                                    placeholder="Enter country name"
                                />
                                <button className="btn btn-primary w-100">Add Country</button>
                            </Col>
                        </Row>
                    </Col>
                </Row>
            </Container>
        </>
    );
};

export default Countries;
