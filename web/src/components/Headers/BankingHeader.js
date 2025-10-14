import React from "react";
import {
  Container,
  Row,
  Col,
  Button
} from "reactstrap";
import 'assets/css/argon-dashboard-pro-react.css';

function BankingHeader({ onAddAccountClick, bankInfo }) {
  const hasBankAccount = !!bankInfo?.id; // assuming `id` or another field proves it exists

  return (
    <div className="header pb-6">
      <Container fluid>
        <div className="header-body">
          <Row className="align-items-center py-4">
            <Col lg="6" xs="6">
              <h6 className="h1 d-inline-block mb-0 mr-2">
                <i className="fa fa-credit-card"></i> Banking
              </h6>
            </Col>
            <Col className="text-right" lg="6" xs="6">
              <Button color="primary" onClick={onAddAccountClick}>
                <i className={`fa ${hasBankAccount ? 'fa-random' : 'fa-plus'}`}></i>{" "}
                {hasBankAccount ? "Change Method" : "Add Method"}
              </Button>
            </Col>
          </Row>
        </div>
      </Container>
    </div>
  );
}

export default BankingHeader;
