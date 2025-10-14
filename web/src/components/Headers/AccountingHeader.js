/*!

=========================================================
* Woss Music Template Version 1.0
=========================================================

* Copyright 2024 Woss Music / Warner Music Latina Inc.

* Coded by Jetix Web

=========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

*/
import React from "react";

// reactstrap components
import {
    Container,
    Row,
    Col,
} from "reactstrap";

function AccountingHeader() {
    return (
        <>
            <div className="header">
                <Container fluid>
                    <div className="header-body">
                        <Row className="align-items-center py-4">
                             <Col lg="6" xs="12" className="d-flex justify-content-between align-items-center">
                            <h6 className="h1 d-inline-block mb-0 mr-2">
                                <i className="fa fa-landmark"></i> Financial Overview
                            </h6>
                    </Col>

                                          
                        </Row>
                    </div>
                </Container>
            </div>
        </>
    );
}

export default AccountingHeader;
