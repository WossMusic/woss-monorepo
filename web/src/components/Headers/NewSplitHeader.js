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
import 'assets/css/argon-dashboard-pro-react.css';

// reactstrap components
import {
    Container,
    Row,
    Col,

} from "reactstrap";

function NewSplitHeader() {
    return (
    <>
    <div className="header pb-6"> 
        <Container fluid >
            <div className="header-body">
                <Row className="align-items-center py-4">
                    <Col lg="6" xs="8">
                        <h6 className="h1 d-inline-block mb-0 mr-2"><i className="fa fa-user-plus"></i> Create Split</h6>
                    </Col>
                </Row>
            </div>
        </Container>
    </div>
    </>
    );
}

export default NewSplitHeader;
